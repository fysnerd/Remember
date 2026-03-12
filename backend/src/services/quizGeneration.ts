// Quiz Generation Service - Uses LLM to generate quiz questions from transcripts
import { prisma } from '../config/database.js';
import { ContentStatus, QuizType } from '@prisma/client';
import { getLLMClient, generateText } from './llm.js';
import pLimit from 'p-limit';
import { llmLimiter } from '../utils/rateLimiter.js';
import { logger } from '../config/logger.js';
import { sendPushToUser } from './pushNotifications.js';

const log = logger.child({ service: 'quiz-generation' });

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizGenerationResult {
  questions: GeneratedQuestion[];
  isEducational: boolean;
  rejectionReason?: string;
  creatorContext?: string;
  contextCues?: string[];
}

// Maximum tokens to send to LLM (roughly 4 chars per token)
const MAX_TRANSCRIPT_CHARS = 12000;

/**
 * Compute target number of quiz questions based on transcript length.
 * Longer content → more questions to cover breadth of material.
 */
function computeTargetQuestionCount(transcriptLength: number): number {
  if (transcriptLength <= 2_000) return 3;   // Reel Instagram, TikTok court
  if (transcriptLength <= 8_000) return 5;   // Video YouTube standard (5-10 min)
  if (transcriptLength <= 30_000) return 7;  // Video moyenne (10-30 min)
  if (transcriptLength <= 80_000) return 10; // Podcast/video longue (30-60 min)
  return 15;                                  // Podcast 1h+
}

/**
 * Distribute a target question count across N chunks.
 * Max 5 questions per chunk (LLM quality degrades beyond that).
 * Returns an array where index i = number of questions for chunk i.
 */
function distributeQuestionsAcrossChunks(target: number, chunkCount: number): number[] {
  const MAX_PER_CHUNK = 5;
  const usableChunks = Math.min(chunkCount, Math.ceil(target / MAX_PER_CHUNK));
  const distribution: number[] = [];
  let remaining = target;

  for (let i = 0; i < usableChunks; i++) {
    const chunksLeft = usableChunks - i;
    const perChunk = Math.min(MAX_PER_CHUNK, Math.ceil(remaining / chunksLeft));
    distribution.push(perChunk);
    remaining -= perChunk;
  }

  return distribution;
}

/** Map platform enum to content type and display label */
function getContentTypeAndLabel(platform: string): { type: 'video' | 'podcast' | 'tiktok' | 'reel'; label: string } {
  switch (platform) {
    case 'YOUTUBE':   return { type: 'video', label: 'YouTube' };
    case 'TIKTOK':    return { type: 'tiktok', label: 'TikTok' };
    case 'INSTAGRAM': return { type: 'reel', label: 'Instagram' };
    case 'SPOTIFY':
    default:          return { type: 'podcast', label: 'Spotify' };
  }
}

/** Resolve creator name from Content fields, returns null if none available */
function getCreatorName(content: {
  channelName?: string | null;
  authorUsername?: string | null;
  showName?: string | null;
}): string | null {
  return content.channelName || content.authorUsername || content.showName || null;
}

/** Build self-referential context string for quiz prompt injection */
function buildCreatorContext(
  platformLabel: string,
  creatorName: string | null,
  capturedAt?: Date | null
): string {
  const platformRef =
    platformLabel === 'TikTok' ? 'video TikTok' :
    platformLabel === 'Instagram' ? 'reel Instagram' :
    platformLabel === 'YouTube' ? 'video YouTube' :
    'podcast Spotify';

  const creatorRef = creatorName ? ` de ${creatorName}` : '';

  const temporalRef = capturedAt
    ? ` (contenu que tu as ${platformLabel === 'Spotify' ? 'ecoute' : 'regarde'} le ${capturedAt.toLocaleDateString('fr-FR')})`
    : '';

  return `cette ${platformRef}${creatorRef}${temporalRef}`;
}

/**
 * Chunk a long transcript into manageable pieces
 */
function chunkTranscript(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Fetch existing quiz questions for a content to avoid repetitions
 */
async function fetchExistingQuestions(contentId: string): Promise<string[]> {
  const existingQuizzes = await prisma.quiz.findMany({
    where: { contentId },
    select: { question: true },
  });
  return existingQuizzes.map(q => q.question);
}

/**
 * Generate quiz questions from transcript using configured LLM
 */
export async function generateQuizFromTranscript(
  transcript: string,
  contentTitle: string,
  _contentType: 'video' | 'podcast' | 'tiktok' | 'reel',
  contentMetadata: {
    creatorName: string | null;
    platformLabel: string;
    capturedAt?: Date | null;
  },
  existingQuestions: string[] = [],
  targetQuestionCount?: number
): Promise<QuizGenerationResult> {
  const llm = getLLMClient();

  const creatorContext = buildCreatorContext(
    contentMetadata.platformLabel,
    contentMetadata.creatorName,
    contentMetadata.capturedAt
  );

  // Chunk transcript if too long
  const chunks = chunkTranscript(transcript, MAX_TRANSCRIPT_CHARS);

  // Use first chunk for quality assessment, all chunks for questions
  const assessmentChunk = chunks[0];

  // Assess content topics and filter doomscrolling content
  const assessmentPrompt = `Analyse cette transcription de ${creatorContext} et évalue sa pertinence pédagogique.

Titre: "${contentTitle}"

Extrait de la transcription:
"""
${assessmentChunk.substring(0, 3000)}
"""

RÈGLES D'ÉVALUATION (isEducational) :
1. Accepte le contenu s'il contient des idées, concepts, histoires, opinions argumentées, conseils ou informations constructives.
2. REJETTE le contenu (isEducational: false) s'il s'agit de musique pure, de silence, ou de contenu inintelligible.
3. REJETTE le contenu (isEducational: false) s'il s'agit de pur "doomscrolling" : contenu exclusivement anxiogène, sensationnaliste, ou polémique sans aucune valeur d'apprentissage ou de réflexion constructive.

EXTRACTION DU CONTEXTE (contextCues) :
Identifie 1 à 3 éléments de contexte spécifiques à cet extrait (une anecdote marquante, un détail visuel décrit, le ton du créateur, ou un exemple précis). Cela servira à réactiver la mémoire contextuelle de l'utilisateur.

Pour chaque sujet identifié, précise le niveau de complexité (basique, intermédiaire, avancé).

Réponds en JSON uniquement selon cette structure :
{
  "isEducational": true/false,
  "isDoomscrolling": true/false,
  "reason": "Brève description justifiant le choix éducatif et le rejet si doomscrolling",
  "mainTopics": ["sujet1", "sujet2", "sujet3"],
  "contextCues": ["indice contextuel 1", "indice contextuel 2"],
  "complexity": "basique|intermédiaire|avancé",
  "contentStyle": "explicatif|narratif|conversationnel|argumentatif"
}`;

  const assessmentResponse = await llmLimiter(() => llm.chatCompletion({
    messages: [
      {
        role: 'system',
        content: 'Tu es un analyste de contenu cognitif et pédagogique. Ton but est d\'évaluer le potentiel d\'apprentissage d\'un contenu, tout en protégeant la charge cognitive de l\'utilisateur. Identifie les sujets, le niveau de complexité, et extrais le contexte spécifique. Réponds uniquement en JSON valide.',
      },
      {
        role: 'user',
        content: assessmentPrompt,
      },
    ],
    temperature: 0.2,
    jsonMode: true,
  }));

  const assessment = JSON.parse(assessmentResponse.content || '{ "isEducational": true, "isDoomscrolling": false, "mainTopics": [], "contextCues": [] }');

  // Reject if not educational OR if pure doomscrolling content
  if (assessment.isEducational === false || assessment.isDoomscrolling === true) {
    return {
      questions: [],
      isEducational: false,
      rejectionReason: assessment.reason || 'Content not suitable for quiz',
      creatorContext,
      contextCues: assessment.contextCues || [],
    };
  }

  // Generate questions from the transcript
  const allQuestions: GeneratedQuestion[] = [];

  // Adaptive distribution: compute how many questions per chunk
  const target = targetQuestionCount ?? 5; // fallback to legacy default
  const distribution = distributeQuestionsAcrossChunks(target, chunks.length);

  log.info(
    { target, chunkCount: chunks.length, distribution, transcriptLength: transcript.length },
    'Adaptive question distribution computed'
  );

  // Accumulate all question texts (existing + newly generated) for inter-chunk anti-repetition
  const allGeneratedQuestionTexts: string[] = [...existingQuestions];

  // Extract context cues for self-reference effect
  const contextCues = assessment.contextCues || [];
  const contextCuesStr = contextCues.length > 0 ? contextCues.join(', ') : 'aucun indice contextuel disponible';

  for (let i = 0; i < distribution.length; i++) {
    const chunk = chunks[i];
    const questionsNeeded = distribution[i];

    // Track if this is the first question batch (for anchoring vs fluidity)
    const isFirstBatch = allQuestions.length === 0;

    // Build anti-repetition block dynamically (includes questions from previous chunks)
    const dynamicAntiRepetitionBlock = allGeneratedQuestionTexts.length > 0
      ? `\nQUESTIONS DEJA POSEES (NE PAS repeter ni reformuler ces questions) :\n${allGeneratedQuestionTexts.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}\n`
      : '';

    const questionPrompt = `Genere EXACTEMENT ${questionsNeeded} questions de quiz a choix multiples basees sur ce contenu.

Titre: "${contentTitle}"
Sujets principaux: ${assessment.mainTopics?.join(', ') || 'Culture generale'}
Style du contenu: ${assessment.contentStyle || 'explicatif'}
${isFirstBatch ? `\nCONTEXTE DE L'ANCRAGE (pour la question 1) : C'est le PREMIER lot de questions. La question 1 doit utiliser l'ancrage fort.` : `\nCONTEXTE DE FLUIDITE : Ce n'est PAS le premier lot. Toutes les questions doivent etre directes et fluides (pas d'ancrage).`}

Contenu source:
"""
${chunk}
"""
${dynamicAntiRepetitionBlock}
Reponds uniquement en JSON:
{
  "questions": [
    {
      "question": "Question (voir regles de contextualisation dans le system prompt)",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "A",
      "explanation": "Explication avec tutoiement...",
      "bloomLevel": "comprendre|appliquer|analyser"
    }
  ]
}`;

    try {
      const questionResponse = await llmLimiter(() => llm.chatCompletion({
        messages: [
          {
            role: 'system',
            content: `Tu es un concepteur pedagogique expert en neurosciences cognitives. Ton objectif est de generer des questions a choix multiples (QCM) qui forcent le "rappel actif" en utilisant l'Effet de Reference a Soi.

Tu as acces aux elements suivants :
- La source : ${creatorContext}
- Les indices contextuels (anecdotes, visuels, ton) : ${contextCuesStr}
- La transcription du contenu.

REGLE D'OR : CONTEXTUALISATION EVOLUTIVE (ANTI-SPAM)
Pour eviter la lourdeur et la surcharge cognitive, la formulation de tes questions doit evoluer :

- POUR LA QUESTION 1 UNIQUEMENT (L'Ancrage) :
  Tu dois faire un ancrage fort. Utilise le tutoiement ("tu"), mentionne la source, et integre un element des indices contextuels.
  -> Modele exige Q1 : "Dans le contenu de ${creatorContext} que tu as enregistre, au moment ou [inserer un element des indices contextuels], quel concept etait explique concernant [sujet] ?"

- POUR LES QUESTIONS SUIVANTES (Fluidite) :
  Ne mentionne PLUS JAMAIS le createur, la video, ou le fait que l'utilisateur l'a enregistre. Garde UNIQUEMENT le tutoiement ("tu", "ton") pour maintenir l'engagement personnel, mais pose la question de maniere directe et naturelle.
  -> Modele exige Q2 et suivantes : "Toujours sur ce sujet, pourquoi [phenomene] se produit-il ?" ou "Comment appliquerais-tu ce concept a..."

- INTERDIT POUR TOUTES LES QUESTIONS: Toute reference a la transcription en tant que telle ("Dans la transcription...").

PRINCIPES PEDAGOGIQUES (Taxonomie de Bloom) - Varie les niveaux cognitifs:
- Comprendre: "Qu'est-ce que [concept] ?" / "Quel est le lien entre X et Y ?"
- Appliquer: "Dans quelle situation utiliserais-tu [concept] ?"
- Analyser: "Pourquoi [fait] est-il important ?"

VARIATION OBLIGATOIRE:
- Chaque question doit aborder un ANGLE DIFFERENT (pas deux questions sur le meme sous-concept).
- Varier les niveaux de difficulte (au moins 2 niveaux differents).

REGLES POUR LES DISTRACTEURS (options incorrectes):
- Chaque distracteur doit etre PLAUSIBLE (pas absurde ni evident).
- Utiliser des erreurs de comprehension courantes comme distracteurs.
- Les distracteurs ne doivent PAS etre partiellement corrects.
- Varier la position de la bonne reponse.

REGLES FINALES POUR LES QUESTIONS:
1. La question doit etre impossible a repondre correctement sans avoir compris le sujet.
2. 4 options exactement (A, B, C, D), une seule correcte.
3. L'explication doit dire POURQUOI la bonne reponse est correcte ET pourquoi les autres ne le sont pas (1-2 phrases). L'explication doit utiliser le tutoiement.
4. Tout en FRANCAIS.

Reponds uniquement en JSON valide.`,
          },
          {
            role: 'user',
            content: questionPrompt,
          },
        ],
        temperature: 0.7,
        jsonMode: true,
      }));

      const result = JSON.parse(questionResponse.content || '{"questions": []}');

      if (result.questions && Array.isArray(result.questions)) {
        // Cap to requested count per chunk (LLM may overshoot)
        const cappedQuestions = result.questions.slice(0, questionsNeeded);
        allQuestions.push(...cappedQuestions);
        // Accumulate for inter-chunk anti-repetition
        for (const q of cappedQuestions) {
          allGeneratedQuestionTexts.push(q.question);
        }
      }
    } catch (error) {
      log.error({ err: error, chunkIndex: i }, 'Error generating questions from chunk');
    }
  }

  // Final deduplication: remove exact duplicate questions
  const seen = new Set<string>();
  const dedupedQuestions = allQuestions.filter(q => {
    const normalized = q.question.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Cap to target total
  const finalQuestions = dedupedQuestions.slice(0, target);

  if (finalQuestions.length < allQuestions.length) {
    log.info(
      { original: allQuestions.length, deduped: dedupedQuestions.length, final: finalQuestions.length, target },
      'Questions trimmed after dedup and cap'
    );
  }

  return {
    questions: finalQuestions,
    isEducational: true,
    creatorContext,
    contextCues: assessment.contextCues || [],
  };
}

/**
 * Generate study carousel from transcript (carousel format for mobile)
 */
export async function generateMemoFromTranscript(
  transcript: string,
  contentTitle: string,
  tags: string[],
  creatorContext?: string,
  contextCues?: string[]
): Promise<string> {
  const transcriptText = transcript.slice(0, 8000);
  const tagsStr = tags.length > 0 ? tags.join(', ') : '';
  const contextCuesStr = contextCues && contextCues.length > 0 ? contextCues.join(', ') : 'aucun indice contextuel disponible';
  const creatorCtx = creatorContext || 'ce contenu';

  const systemPrompt = `Tu es un concepteur pedagogique expert en neurosciences cognitives. Tu transformes des transcriptions de videos/podcasts en CARROUSELS D'ETUDE optimises pour la retention a long terme sur mobile.

PRINCIPES SCIENTIFIQUES APPLIQUES:
- Effet de Reference a Soi (Rogers, 1977) : L'information doit etre liee a l'utilisateur. Utilise le tutoiement ("tu", "ton"). Rappelle-lui pourquoi IL a trouve ce contenu interessant.
- Microlearning & Charge Cognitive (Sweller, 1988) : Puisque le format est un CARROUSEL, la regle absolue est : 1 Slide = 1 Idee = 40 mots maximum. Ne surcharge jamais une slide.
- Technique de Feynman : Explique chaque concept comme si tu parlais a un adolescent, PUIS introduis le terme technique.
- Meaningfulness (Ebbinghaus, 1885) : Relie les concepts abstraits a la vie quotidienne d'un jeune adulte (18-25 ans) ou a l'anecdote de la video.

STRUCTURE DU CARROUSEL (Format de sortie exige) :
Tu dois structurer ta reponse exactement selon ces Slides :

[SLIDE 1 : LE DECLIC]
- Objectif : Le "Takeaway" principal combine au contexte de l'utilisateur.
- Format : "Dans ce contenu de ${creatorCtx} ou [inserer un element des indices contextuels], voici ce que tu as voulu retenir :" + 1 phrase choc resumant l'essentiel.

[SLIDE 2 a 4 : LES CONCEPTS CLES] (Genere 2 a 3 slides maximum ici)
- Objectif : 1 Slide = 1 Concept (Chunking).
- Format :
  * [Emoji] **[Nom du Concept]**
  * Explication simple (Feynman) en 1 phrase.
  * "En pratique :" ou "C'est comme :" suivi d'une analogie ou d'un exemple tire du contenu.

[SLIDE 5 : LA CONNEXION]
- Objectif : Relier ce savoir a la vie de l'utilisateur (Schema theory).
- Format : "Pourquoi c'est important pour toi :" + 1 phrase expliquant comment utiliser cette information dans sa vie quotidienne, ses etudes ou sa culture generale.

CONTRAINTES STRICTES :
- Langage SIMPLE, DIRECT et CONVERSATIONNEL.
- PAS de jargon sans explication.
- PAS de formulations scolaires ou passives ("Il est interessant de noter que..."). Sois percutant.
- Genere UNIQUEMENT le texte des slides, separe par des balises claires (ex: --- SLIDE 1 ---).
- Tout en FRANCAIS.`;

  const userPrompt = `Titre original : "${contentTitle}"
Source : ${creatorCtx}
Indices contextuels (Context Cues) : ${contextCuesStr}
Themes : ${tagsStr ? tagsStr : 'Culture generale'}

Transcription :
"""
${transcriptText}
"""

Genere le carrousel d'etude selon les regles strictes.`;

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.5 });
}

/**
 * Generate a cognitive synopsis from transcription + description (curiosity gap trigger)
 */
export async function generateSynopsis(
  transcript: string,
  description: string | null,
  contentTitle: string,
  creatorContext?: string,
  contextCues?: string[]
): Promise<string> {
  const transcriptText = transcript.slice(0, 6000);
  const descriptionText = description?.slice(0, 500) || '';
  const creatorCtx = creatorContext || 'ce contenu';
  const contextCuesStr = contextCues && contextCues.length > 0 ? contextCues.join(', ') : 'aucun indice contextuel disponible';

  const systemPrompt = `Tu es un expert en neuro-pedagogie et en copywriting pour l'application Ankora. Tu generes des synopsis ultra-concis (2 phrases) qui agissent comme des declencheurs cognitifs pour motiver l'utilisateur a reviser.

Regles et Principes Scientifiques :
- Effet de Reference a Soi : Utilise obligatoirement le tutoiement ("tu", "ton"). Parle directement a l'utilisateur de *son* choix d'avoir sauvegarde ce contenu.
- Ecart de Curiosite (Curiosity Gap) : Ne donne JAMAIS la reponse factuelle finale. Tease le concept, le "pourquoi" ou le mecanisme que l'utilisateur va devoir maitriser.
- Utilite (Meaningfulness) : Fais comprendre en quoi cette connaissance lui est utile dans sa vie ou pour sa culture.

Structure Exigee (Exactement 2 phrases) :
- Phrase 1 (L'Ancrage) : Rappelle son interaction en integrant la source (${creatorCtx}) et un indice visuel ou contextuel.
- Phrase 2 (Le Hook) : Formule la promesse de connaissance sans la devoiler.

Contraintes STRICTES :
- Maximum 2 phrases COURTES (40 mots max au total).
- AUCUN emoji (interdiction absolue).
- Pas de formulations passives comme "Cette video parle de...", "Decouvrez...", "L'auteur explique...".
- Entierement en francais.`;

  const userPrompt = `Titre: "${contentTitle}"
Source : ${creatorCtx}
Indices contextuels (Context Cues) : ${contextCuesStr}
${descriptionText ? `Description originale: "${descriptionText}"` : ''}

Transcription (extrait):
"""
${transcriptText}
"""

Genere le synopsis cognitif (2 phrases courtes, 40 mots max, 0 emoji) selon les regles exigees.`;

  return generateText(userPrompt, { system: systemPrompt, temperature: 0.5 });
}

// ============================================================================
// Synthesis Question Generation (Cross-content)
// ============================================================================

interface SynthesisGenerationResult {
  questions: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    sourceIndices: number[];
  }[];
}

/**
 * Generate cross-content synthesis questions for a theme.
 * Requires 2+ content memos to create questions that connect ideas from different sources.
 */
export async function generateSynthesisQuestions(
  themeName: string,
  contentMemos: { id: string; title: string; memo: string }[],
  maxQuestions: number = 5
): Promise<SynthesisGenerationResult> {
  if (contentMemos.length < 2) {
    return { questions: [] };
  }

  try {
    const memosText = contentMemos
      .map((cm, i) => `[Source ${i + 1}: "${cm.title}"]\n${cm.memo.substring(0, 2000)}`)
      .join('\n\n---\n\n');

    const systemPrompt = `Tu es un expert en neuro-pedagogie specialise dans la theorie des schemas cognitifs (Schema Theory) pour l'application Ankora. Ton role est de creer des questions de SYNTHESE inter-contenus qui forcent l'utilisateur a connecter differentes informations qu'IL a lui-meme selectionnees, creant ainsi des reseaux neuronaux durables.

REGLES DE CONTEXTUALISATION (Effet de Reference a Soi) :
- Utilise obligatoirement le tutoiement ("tu", "tes contenus").
- Rappelle a l'utilisateur que ce sont SES interets qui se croisent.
- Exemple de formulation : "En reliant ce que tu as appris dans [Source 1] et dans [Source 2], quelle conclusion peux-tu tirer sur..." ou "Si tu combines le concept vu dans [Source 1] avec le mecanisme de [Source 2]..."

REGLES PEDAGOGIQUES ET COGNITIVES :
- Chaque question DOIT necessiter la comprehension d'AU MOINS 2 sources differentes parmi celles fournies.
- Les questions doivent relier, comparer ou connecter des idees (comparaison, cause-effet, generalisation, contradiction, complementarite).
- 4 options (A-D), une seule correcte.
- Difficulte Desirable : Les distracteurs (mauvaises reponses) doivent etre tres plausibles -- ils doivent sembler parfaitement logiques si l'utilisateur ne se souvient que d'UNE seule des deux sources.

REGLE POUR L'EXPLICATION :
- L'explication doit etre formulee comme un feedback de coach ("Exactement !", "Et non, car...").
- Elle doit obligatoirement nommer les sources concernees et expliquer clairement la mecanique qui les relie.
- PAS d'emoji. Tout en FRANCAIS.
- Style direct, clair, evitant la surcharge cognitive.

Reponds UNIQUEMENT en JSON valide.`;

    const userPrompt = `Theme: "${themeName}"
Nombre de sources: ${contentMemos.length}

Contenus (Memos) :
"""
${memosText}
"""

Genere EXACTEMENT ${maxQuestions} questions de synthese (0 emoji) qui connectent les idees de plusieurs sources selon les regles exigees. Reponds UNIQUEMENT en JSON valide.

Format JSON attendu:
{
  "questions": [
    {
      "question": "Question de synthese claire, tutoyant l'utilisateur et nommant les sources ?",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "A",
      "explanation": "Explication directe et valorisante, mentionnant explicitement comment les sources se completent...",
      "sourceIndices": [1, 2]
    }
  ]
}`;

    const response = await llmLimiter(() =>
      getLLMClient().chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        jsonMode: true,
      })
    );

    const parsed = JSON.parse(response.content || '{"questions": []}');

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      log.warn({ themeName }, 'Synthesis generation returned invalid format');
      return { questions: [] };
    }

    // Post-process: filter out questions where sourceIndices has fewer than 2 entries
    const validQuestions = parsed.questions.filter(
      (q: any) => Array.isArray(q.sourceIndices) && q.sourceIndices.length >= 2
    );

    log.info(
      { themeName, questionCount: validQuestions.length, contentCount: contentMemos.length },
      'Synthesis questions generated'
    );

    return { questions: validQuestions };
  } catch (error) {
    log.error({ err: error, themeName }, 'Error generating synthesis questions');
    return { questions: [] };
  }
}

/**
 * Process content to generate quiz questions and create cards
 */
export async function processContentQuiz(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      transcript: true,
      quizzes: true,
      tags: true, // Include tags for memo generation
    },
  });

  if (!content) {
    log.error({ contentId }, 'Content not found');
    return false;
  }

  // Check if already has quizzes
  if (content.quizzes.length > 0) {
    log.debug({ contentId }, 'Content already has quizzes');
    return true;
  }

  // Must have transcript
  if (!content.transcript) {
    log.debug({ contentId }, 'Content has no transcript, skipping');
    return false;
  }

  // Update status to generating
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.GENERATING },
  });

  try {
    const { type: contentType, label: platformLabel } = getContentTypeAndLabel(content.platform);
    const creatorName = getCreatorName(content);

    const targetQuestions = computeTargetQuestionCount(content.transcript.text.length);
    log.info({ contentId, title: content.title, platform: content.platform, creator: creatorName, targetQuestions, transcriptLength: content.transcript.text.length }, 'Generating quiz');
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      },
      [],
      targetQuestions
    );

    if (!result.isEducational) {
      log.warn({ contentId, reason: result.rejectionReason }, 'Content not educational');
      // Still mark as ready, but with no quizzes
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    if (result.questions.length === 0) {
      log.warn({ contentId }, 'No questions generated');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    // Create quizzes and cards in transaction
    await prisma.$transaction(async (tx) => {
      // SRS-01: First review in 24h
      const cardNextReview = new Date();
      cardNextReview.setDate(cardNextReview.getDate() + 1);

      for (const q of result.questions) {
        // Create quiz
        const quiz = await tx.quiz.create({
          data: {
            contentId: content.id,
            question: q.question,
            type: QuizType.MULTIPLE_CHOICE,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });

        // Create card for the user who owns this content
        await tx.card.create({
          data: {
            quizId: quiz.id,
            userId: content.userId,
            nextReviewAt: cardNextReview,
          },
        });
      }

      // Update content status
      await tx.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
    });

    // Notify user that quiz is ready
    const titleShort = content.title.length > 50
      ? content.title.substring(0, 47) + '...'
      : content.title;
    sendPushToUser(
      content.userId,
      'Quiz pret !',
      `${result.questions.length} questions sur "${titleShort}"`,
      { screen: '/(tabs)', contentId: content.id }
    ).catch(() => {}); // fire-and-forget, don't block pipeline

    // Generate memo + synopsis in parallel (non-blocking, after quiz creation)
    const postProcessing: Promise<void>[] = [];

    // Memo (carousel) generation with context cues for self-reference effect
    postProcessing.push(
      (async () => {
        log.debug({ contentId, title: content.title }, 'Generating carousel memo');
        try {
          const tagNames = content.tags.map(t => t.name);
          const memo = await generateMemoFromTranscript(
            content.transcript!.text,
            content.title,
            tagNames,
            result.creatorContext,
            result.contextCues || []
          );
          await prisma.content.update({
            where: { id: contentId },
            data: { memo, memoGeneratedAt: new Date() },
          });
          log.info({ contentId }, 'Carousel memo generated and cached');
        } catch (memoError) {
          log.error({ err: memoError, contentId }, 'Carousel memo generation failed');
        }
      })()
    );

    // Synopsis (cognitive trigger) generation with context cues
    if (!content.synopsis) {
      postProcessing.push(
        (async () => {
          try {
            const synopsis = await generateSynopsis(
              content.transcript!.text,
              content.description,
              content.title,
              result.creatorContext,
              result.contextCues || []
            );
            await prisma.content.update({
              where: { id: contentId },
              data: { synopsis },
            });
            log.info({ contentId }, 'Cognitive synopsis generated');
          } catch (synopsisError) {
            log.error({ err: synopsisError, contentId }, 'Synopsis generation failed');
          }
        })()
      );
    }

    await Promise.allSettled(postProcessing);

    log.info({ contentId, questionCount: result.questions.length, title: content.title }, 'Quiz generation completed');
    return true;

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTransient = /429|rate.limit|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|503|502|socket hang up/i.test(errorMsg);

    if (isTransient) {
      // Revert to SELECTED so the cron worker retries on next run
      log.warn({ err: error, contentId }, 'Transient error during quiz generation, will retry');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.SELECTED },
      });
    } else {
      log.error({ err: error, contentId }, 'Permanent error generating quiz');
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.FAILED },
      });
    }
    return false;
  }
}

/**
 * Regenerate quiz for content (user requested)
 */
export async function regenerateQuiz(contentId: string): Promise<boolean> {
  // Fetch existing questions BEFORE deleting for anti-repetition
  const previousQuestions = await fetchExistingQuestions(contentId);

  log.info(
    { contentId, previousQuestionCount: previousQuestions.length },
    'Regenerating quiz with anti-repetition context'
  );

  // Delete existing quizzes and cards
  await prisma.quiz.deleteMany({
    where: { contentId },
  });

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true, quizzes: true, tags: true },
  });

  if (!content || !content.transcript) {
    log.error({ contentId }, 'Content or transcript not found for regeneration');
    return false;
  }

  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.GENERATING },
  });

  try {
    const { type: contentType, label: platformLabel } = getContentTypeAndLabel(content.platform);
    const creatorName = getCreatorName(content);
    const targetQuestions = computeTargetQuestionCount(content.transcript.text.length);
    const result = await generateQuizFromTranscript(
      content.transcript.text,
      content.title,
      contentType,
      {
        creatorName,
        platformLabel,
        capturedAt: content.capturedAt,
      },
      previousQuestions,
      targetQuestions
    );

    if (!result.isEducational || result.questions.length === 0) {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
      return true;
    }

    await prisma.$transaction(async (tx) => {
      // SRS-01: First review in 24h
      const regenNextReview = new Date();
      regenNextReview.setDate(regenNextReview.getDate() + 1);

      for (const q of result.questions) {
        const quiz = await tx.quiz.create({
          data: {
            contentId: content.id,
            question: q.question,
            type: QuizType.MULTIPLE_CHOICE,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });
        await tx.card.create({
          data: { quizId: quiz.id, userId: content.userId, nextReviewAt: regenNextReview },
        });
      }
      await tx.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.READY },
      });
    });

    log.info({ contentId, questionCount: result.questions.length }, 'Quiz regeneration completed');
    return true;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTransient = /429|rate.limit|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|503|502|socket hang up/i.test(errorMsg);
    if (isTransient) {
      await prisma.content.update({ where: { id: contentId }, data: { status: ContentStatus.SELECTED } });
    } else {
      await prisma.content.update({ where: { id: contentId }, data: { status: ContentStatus.FAILED } });
    }
    return false;
  }
}

/**
 * Background worker to process pending quiz generation
 */
export async function runQuizGenerationWorker(): Promise<void> {
  log.info('Quiz generation worker starting');

  // Recovery: unstick items stuck in GENERATING for >10 minutes (e.g. after PM2 restart)
  const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stuckItems = await prisma.content.updateMany({
    where: {
      status: ContentStatus.GENERATING,
      updatedAt: { lt: stuckCutoff },
    },
    data: { status: ContentStatus.SELECTED },
  });
  if (stuckItems.count > 0) {
    log.warn({ count: stuckItems.count }, 'Reset stuck GENERATING items back to SELECTED');
  }

  // Get content items with transcripts that need quiz generation (SELECTED only)
  // INBOX content is pre-transcribed but must wait for user triage before quiz gen
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      transcript: { isNot: null },
      quizzes: { none: {} },
    },
    take: 10,
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    log.debug('No pending content for quiz generation');
    return;
  }

  log.info({ count: pendingContent.length }, 'Processing pending content');

  let success = 0;
  let failed = 0;

  const limit = pLimit(3); // Each quiz needs ~3 LLM calls (assessment + questions + memo)

  const results = await Promise.allSettled(
    pendingContent.map(content =>
      limit(() => processContentQuiz(content.id))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  }

  log.info({ success, failed }, 'Quiz generation worker completed');
}

/**
 * Backfill synopsis for existing content that has transcript but no synopsis
 */
export async function runSynopsisBackfill(): Promise<void> {
  log.info('Synopsis backfill starting');

  const contents = await prisma.content.findMany({
    where: {
      synopsis: null,
      transcript: { isNot: null },
    },
    include: { transcript: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  if (contents.length === 0) {
    log.debug('No content needs synopsis backfill');
    return;
  }

  log.info({ count: contents.length }, 'Backfilling synopsis');

  const limit = pLimit(3);
  let success = 0;

  await Promise.allSettled(
    contents.map(content =>
      limit(async () => {
        try {
          const synopsis = await generateSynopsis(
            content.transcript!.text,
            content.description,
            content.title
          );
          await prisma.content.update({
            where: { id: content.id },
            data: { synopsis },
          });
          success++;
        } catch (err) {
          log.error({ err, contentId: content.id }, 'Synopsis backfill failed for content');
        }
      })
    )
  );

  log.info({ success, total: contents.length }, 'Synopsis backfill completed');
}
