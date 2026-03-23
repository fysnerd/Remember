/**
 * Centralized module for all language-dependent LLM prompt strings.
 * Used by quizGeneration, tagging, themeClassification services.
 */
import { normalizeLanguage, SupportedLanguage } from '../utils/language.js';

// ============================================================================
// Types
// ============================================================================

export interface PromptLocale {
  // General
  languageInstruction: string;          // "Tout en FRANCAIS." / "Everything in ENGLISH."
  respondJsonOnly: string;              // "Reponds uniquement en JSON valide." / "Respond only in valid JSON."

  // Roles
  youAre: string;                       // "Tu es" / "You are"
  pedagogicalDesigner: string;          // "un concepteur pedagogique expert en neurosciences cognitives"
  contentAnalyst: string;               // "un analyste de contenu cognitif et pedagogique"
  tagExpert: string;                    // "un expert en categorisation de contenu"
  knowledgeOrganizer: string;           // "un expert en organisation de connaissances"
  neuroPedagogyExpert: string;          // "un expert en neuro-pedagogie"
  contentClassifier: string;            // "Tu classes du contenu dans des themes existants."

  // Tag generation
  tagInstruction: string;               // Full system prompt for tag generation
  tagUserPrompt: (title: string, transcript: string) => string;

  // Quiz generation — assessment
  assessmentSystemPrompt: string;
  assessmentUserPrompt: (creatorContext: string, contentTitle: string, transcriptExcerpt: string) => string;

  // Quiz generation — questions
  quizSystemPrompt: (creatorContext: string, contextCuesStr: string) => string;
  generateQuestions: (n: number) => string;
  quizUserPrompt: (opts: {
    questionsNeeded: number;
    contentTitle: string;
    mainTopics: string;
    contentStyle: string;
    isFirstBatch: boolean;
    chunk: string;
    antiRepetitionBlock: string;
  }) => string;

  // Memo (carousel) generation
  memoSystemPrompt: (creatorCtx: string) => string;
  memoUserPrompt: (opts: {
    contentTitle: string;
    creatorCtx: string;
    contextCuesStr: string;
    tagsStr: string;
    transcriptText: string;
  }) => string;

  // Synopsis generation
  synopsisSystemPrompt: (creatorCtx: string) => string;
  synopsisUserPrompt: (opts: {
    contentTitle: string;
    creatorCtx: string;
    contextCuesStr: string;
    descriptionText: string;
    transcriptText: string;
  }) => string;

  // Synthesis (cross-content) questions
  generateSynthesis: (n: number) => string;
  synthesisSystemPrompt: string;
  synthesisUserPrompt: (opts: {
    themeName: string;
    contentCount: number;
    memosText: string;
    maxQuestions: number;
  }) => string;

  // Theme classification
  themeGenerationSystemPrompt: string;
  themeGenerationUserPrompt: (tagList: string, existingList: string) => string;
  themeClassificationSystemPrompt: string;
  themeClassificationUserPrompt: (contentTitle: string, contentTags: string, themeList: string) => string;

  // Content reference helpers
  contentRef: (type: string, creator: string, temporal: string) => string;
  watched: string;                      // "regarde" / "watched"
  listened: string;                     // "ecoute" / "listened"

  // Slide labels
  slideLabels: {
    hook: string;                       // "LE DECLIC" / "THE HOOK"
    concepts: string;                   // "LES CONCEPTS CLES" / "KEY CONCEPTS"
    takeaway: string;                   // "LA CONNEXION" / "THE CONNECTION"
  };

  // Date locale
  dateLocale: string;                   // "fr-FR" / "en-US"

  // Platform references
  platformRef: (platformLabel: string) => string;
  contentCountLabel: string;            // "contenus" / "items"

  // Push notification
  quizReadyTitle: string;               // "Quiz pret !" / "Quiz ready!"
  quizReadyBody: (count: number, title: string) => string;

  // Assessment labels
  complexityLabels: { basic: string; intermediate: string; advanced: string };
  styleLabels: { explanatory: string; narrative: string; conversational: string; argumentative: string };
}

// ============================================================================
// French Locale
// ============================================================================

const fr: PromptLocale = {
  languageInstruction: 'Tout en FRANCAIS.',
  respondJsonOnly: 'Reponds uniquement en JSON valide.',

  youAre: 'Tu es',
  pedagogicalDesigner: 'un concepteur pedagogique expert en neurosciences cognitives',
  contentAnalyst: 'un analyste de contenu cognitif et pedagogique',
  tagExpert: 'un expert en categorisation de contenu',
  knowledgeOrganizer: 'un expert en organisation de connaissances',
  neuroPedagogyExpert: 'un expert en neuro-pedagogie',
  contentClassifier: 'Tu classes du contenu dans des themes existants. Reponds UNIQUEMENT en JSON valide.',

  // --- Tag generation ---
  tagInstruction: `Tu es un expert en categorisation de contenu. Genere 3-5 tags pertinents EN FRANCAIS pour le contenu donne.

Regles:
- Tags en minuscules, en francais, 1 a 3 mots maximum
- Privilegie les termes couramment utilises en francais (meme si le terme anglais existe)
- Les tags doivent decrire le SUJET principal, le DOMAINE et le TYPE de connaissance
- Sois specifique mais pas trop niche (le tag doit pouvoir regrouper plusieurs contenus)
- Bons exemples: "intelligence artificielle", "productivite", "histoire", "psychologie", "entrepreneuriat", "nutrition"
- Mauvais exemples: "interessant", "video", "episode", "cool", "important"
- Si un terme anglais est universellement utilise en francais (ex: "machine learning", "marketing"), garde-le

Retourne UNIQUEMENT un tableau JSON de strings.
Exemple: ["psychologie cognitive", "memoire", "apprentissage"]`,

  tagUserPrompt: (title, transcript) =>
    `Titre: ${title}\n\nContenu:\n${transcript}\n\nGenere 3-5 tags pertinents en francais pour ce contenu.`,

  // --- Assessment ---
  assessmentSystemPrompt: `Tu es un analyste de contenu cognitif et pedagogique. Ton but est d'evaluer le potentiel d'apprentissage d'un contenu, tout en protegeant la charge cognitive de l'utilisateur. Identifie les sujets, le niveau de complexite, et extrais le contexte specifique. Reponds uniquement en JSON valide.`,

  assessmentUserPrompt: (creatorContext, contentTitle, transcriptExcerpt) =>
    `Analyse cette transcription de ${creatorContext} et evalue sa pertinence pedagogique.

Titre: "${contentTitle}"

Extrait de la transcription:
"""
${transcriptExcerpt}
"""

REGLES D'EVALUATION (isEducational) :
1. Accepte le contenu s'il contient des idees, concepts, histoires, opinions argumentees, conseils ou informations constructives.
2. REJETTE le contenu (isEducational: false) s'il s'agit de musique pure, de silence, ou de contenu inintelligible.
3. REJETTE le contenu (isEducational: false) s'il s'agit de pur "doomscrolling" : contenu exclusivement anxiogene, sensationnaliste, ou polemique sans aucune valeur d'apprentissage ou de reflexion constructive.

EXTRACTION DU CONTEXTE (contextCues) :
Identifie 1 a 3 elements de contexte specifiques a cet extrait (une anecdote marquante, un detail visuel decrit, le ton du createur, ou un exemple precis). Cela servira a reactiver la memoire contextuelle de l'utilisateur.

Pour chaque sujet identifie, precise le niveau de complexite (basique, intermediaire, avance).

Reponds en JSON uniquement selon cette structure :
{
  "isEducational": true/false,
  "isDoomscrolling": true/false,
  "reason": "Breve description justifiant le choix educatif et le rejet si doomscrolling",
  "mainTopics": ["sujet1", "sujet2", "sujet3"],
  "contextCues": ["indice contextuel 1", "indice contextuel 2"],
  "complexity": "basique|intermediaire|avance",
  "contentStyle": "explicatif|narratif|conversationnel|argumentatif"
}`,

  // --- Quiz questions ---
  quizSystemPrompt: (creatorContext, contextCuesStr) =>
    `Tu es un concepteur pedagogique expert en neurosciences cognitives. Ton objectif est de generer des questions a choix multiples (QCM) qui forcent le "rappel actif" en utilisant l'Effet de Reference a Soi.

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

  generateQuestions: (n) => `Genere EXACTEMENT ${n} questions de quiz a choix multiples basees sur ce contenu.`,

  quizUserPrompt: ({ questionsNeeded, contentTitle, mainTopics, contentStyle, isFirstBatch, chunk, antiRepetitionBlock }) =>
    `Genere EXACTEMENT ${questionsNeeded} questions de quiz a choix multiples basees sur ce contenu.

Titre: "${contentTitle}"
Sujets principaux: ${mainTopics || 'Culture generale'}
Style du contenu: ${contentStyle || 'explicatif'}

${isFirstBatch ? `\nCONTEXTE DE L'ANCRAGE (pour la question 1) : C'est le PREMIER lot de questions. La question 1 doit utiliser l'ancrage fort.` : `\nCONTEXTE DE FLUIDITE : Ce n'est PAS le premier lot. Toutes les questions doivent etre directes et fluides (pas d'ancrage).`}

Contenu source:
"""
${chunk}
"""
${antiRepetitionBlock}
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
}`,

  // --- Memo (carousel) ---
  memoSystemPrompt: (creatorCtx) =>
    `Tu es un concepteur pedagogique expert en neurosciences cognitives. Tu transformes des transcriptions de videos/podcasts en CARROUSELS D'ETUDE optimises pour la retention a long terme sur mobile.

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
- Tout en FRANCAIS.`,

  memoUserPrompt: ({ contentTitle, creatorCtx, contextCuesStr, tagsStr, transcriptText }) =>
    `Titre original : "${contentTitle}"
Source : ${creatorCtx}
Indices contextuels (Context Cues) : ${contextCuesStr}
Themes : ${tagsStr ? tagsStr : 'Culture generale'}

Transcription :
"""
${transcriptText}
"""

Genere le carrousel d'etude selon les regles strictes.`,

  // --- Synopsis ---
  synopsisSystemPrompt: (creatorCtx) =>
    `Tu es un expert en neuro-pedagogie et en copywriting pour l'application Ankora. Tu generes des synopsis ultra-concis (2 phrases) qui agissent comme des declencheurs cognitifs pour motiver l'utilisateur a reviser.

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
- Entierement en francais.`,

  synopsisUserPrompt: ({ contentTitle, creatorCtx, contextCuesStr, descriptionText, transcriptText }) =>
    `Titre: "${contentTitle}"
Source : ${creatorCtx}
Indices contextuels (Context Cues) : ${contextCuesStr}
${descriptionText ? `Description originale: "${descriptionText}"` : ''}

Transcription (extrait):
"""
${transcriptText}
"""

Genere le synopsis cognitif (2 phrases courtes, 40 mots max, 0 emoji) selon les regles exigees.`,

  // --- Synthesis ---
  generateSynthesis: (n) => `Genere EXACTEMENT ${n} questions de synthese`,

  synthesisSystemPrompt: `Tu es un expert en neuro-pedagogie specialise dans la theorie des schemas cognitifs (Schema Theory) pour l'application Ankora. Ton role est de creer des questions de SYNTHESE inter-contenus qui forcent l'utilisateur a connecter differentes informations qu'IL a lui-meme selectionnees, creant ainsi des reseaux neuronaux durables.

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

Reponds UNIQUEMENT en JSON valide.`,

  synthesisUserPrompt: ({ themeName, contentCount, memosText, maxQuestions }) =>
    `Theme: "${themeName}"
Nombre de sources: ${contentCount}

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
}`,

  // --- Theme classification ---
  themeGenerationSystemPrompt: `Tu es un expert en organisation de connaissances. Tu regroupes des tags de contenu en themes coherents.

Regles:
- Genere entre 5 et 15 themes maximum
- Chaque theme regroupe des tags SEMANTIQUEMENT proches
- Fusionne les synonymes et traductions (ex: "music" + "musique" = un seul theme)
- Fusionne les variantes (ex: "rap", "french rap", "hip hop" = un seul theme)
- Ignore les tags utilises une seule fois sauf s'ils correspondent a un theme existant
- Noms de themes en francais, clairs et concis (2-4 mots max)
- PAS D'EMOJI dans la reponse (mettre une chaine vide pour emoji)
- Chaque theme doit avoir une couleur hex
- Un tag peut appartenir a plusieurs themes si pertinent

Reponds UNIQUEMENT en JSON valide.`,

  themeGenerationUserPrompt: (tagList, existingList) =>
    `Voici les tags d'un utilisateur avec leur frequence d'utilisation:
${tagList}
${existingList}

Regroupe ces tags en themes coherents. Pour chaque theme, indique:
- name: nom du theme en francais
- description: une courte description du theme (1 phrase, max 15 mots, en francais)
- color: code hex (parmi: #EF4444, #F97316, #EAB308, #22C55E, #14B8A6, #3B82F6, #6366F1, #8B5CF6, #EC4899, #F43F5E, #06B6D4, #84CC16)
- tags: liste des tags regroupes dans ce theme

Format:
{
  "themes": [
    {
      "name": "Nom du theme",
      "emoji": "",
      "description": "Courte description du theme",
      "color": "#hex",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}`,

  themeClassificationSystemPrompt: `Tu classes du contenu dans des themes existants. Reponds UNIQUEMENT en JSON valide.`,

  themeClassificationUserPrompt: (contentTitle, contentTags, themeList) =>
    `Contenu: "${contentTitle}"
Tags du contenu: ${contentTags}

Themes disponibles:
${themeList}

Dans quel(s) theme(s) ce contenu devrait-il etre classe? (1 a 3 themes max)

Reponds: { "themeNames": ["Nom theme 1", "Nom theme 2"] }
Si aucun theme ne correspond, reponds: { "themeNames": [] }`,

  // --- Content reference ---
  contentRef: (type, creator, temporal) => `cette ${type}${creator}${temporal}`,
  watched: 'regarde',
  listened: 'ecoute',

  // --- Slide labels ---
  slideLabels: {
    hook: 'LE DECLIC',
    concepts: 'LES CONCEPTS CLES',
    takeaway: 'LA CONNEXION',
  },

  dateLocale: 'fr-FR',

  platformRef: (platformLabel) => {
    switch (platformLabel) {
      case 'TikTok':   return 'video TikTok';
      case 'Instagram': return 'reel Instagram';
      case 'YouTube':  return 'video YouTube';
      default:         return 'podcast Spotify';
    }
  },

  contentCountLabel: 'contenus',

  quizReadyTitle: 'Quiz pret !',
  quizReadyBody: (count, title) => `${count} questions sur "${title}"`,

  complexityLabels: { basic: 'basique', intermediate: 'intermediaire', advanced: 'avance' },
  styleLabels: { explanatory: 'explicatif', narrative: 'narratif', conversational: 'conversationnel', argumentative: 'argumentatif' },
};

// ============================================================================
// English Locale
// ============================================================================

const en: PromptLocale = {
  languageInstruction: 'Everything in ENGLISH.',
  respondJsonOnly: 'Respond only in valid JSON.',

  youAre: 'You are',
  pedagogicalDesigner: 'an expert pedagogical designer in cognitive neuroscience',
  contentAnalyst: 'a cognitive and pedagogical content analyst',
  tagExpert: 'an expert in content categorization',
  knowledgeOrganizer: 'an expert in knowledge organization',
  neuroPedagogyExpert: 'an expert in neuro-pedagogy',
  contentClassifier: 'You classify content into existing themes. Respond ONLY in valid JSON.',

  // --- Tag generation ---
  tagInstruction: `You are an expert in content categorization. Generate 3-5 relevant tags IN ENGLISH for the given content.

Rules:
- Tags in lowercase, in English, 1 to 3 words maximum
- Prefer commonly used English terms
- Tags should describe the main TOPIC, the DOMAIN and the TYPE of knowledge
- Be specific but not too niche (the tag should be able to group multiple pieces of content)
- Good examples: "artificial intelligence", "productivity", "history", "psychology", "entrepreneurship", "nutrition"
- Bad examples: "interesting", "video", "episode", "cool", "important"

Return ONLY a JSON array of strings.
Example: ["cognitive psychology", "memory", "learning"]`,

  tagUserPrompt: (title, transcript) =>
    `Title: ${title}\n\nContent:\n${transcript}\n\nGenerate 3-5 relevant tags in English for this content.`,

  // --- Assessment ---
  assessmentSystemPrompt: `You are a cognitive and pedagogical content analyst. Your goal is to evaluate the learning potential of content while protecting the user's cognitive load. Identify topics, complexity level, and extract specific context. Respond only in valid JSON.`,

  assessmentUserPrompt: (creatorContext, contentTitle, transcriptExcerpt) =>
    `Analyze this transcript from ${creatorContext} and evaluate its pedagogical relevance.

Title: "${contentTitle}"

Transcript excerpt:
"""
${transcriptExcerpt}
"""

EVALUATION RULES (isEducational):
1. Accept the content if it contains ideas, concepts, stories, well-argued opinions, advice, or constructive information.
2. REJECT the content (isEducational: false) if it is pure music, silence, or unintelligible content.
3. REJECT the content (isEducational: false) if it is pure "doomscrolling": exclusively anxiety-inducing, sensationalist, or polemical content with no learning or constructive reflection value.

CONTEXT EXTRACTION (contextCues):
Identify 1 to 3 specific context elements from this excerpt (a notable anecdote, a described visual detail, the creator's tone, or a specific example). These will serve to reactivate the user's contextual memory.

For each identified topic, specify the complexity level (basic, intermediate, advanced).

Respond in JSON only with this structure:
{
  "isEducational": true/false,
  "isDoomscrolling": true/false,
  "reason": "Brief description justifying the educational choice and rejection if doomscrolling",
  "mainTopics": ["topic1", "topic2", "topic3"],
  "contextCues": ["context cue 1", "context cue 2"],
  "complexity": "basic|intermediate|advanced",
  "contentStyle": "explanatory|narrative|conversational|argumentative"
}`,

  // --- Quiz questions ---
  quizSystemPrompt: (creatorContext, contextCuesStr) =>
    `You are an expert pedagogical designer in cognitive neuroscience. Your goal is to generate multiple-choice questions (MCQ) that force "active recall" using the Self-Reference Effect.

You have access to the following elements:
- The source: ${creatorContext}
- Context cues (anecdotes, visuals, tone): ${contextCuesStr}
- The content transcript.

GOLDEN RULE: EVOLVING CONTEXTUALIZATION (ANTI-SPAM)
To avoid heaviness and cognitive overload, the phrasing of your questions must evolve:

- FOR QUESTION 1 ONLY (The Anchor):
  You must create a strong anchor. Use informal address ("you"), mention the source, and integrate an element from the context cues.
  -> Required model Q1: "In the content from ${creatorContext} that you saved, when [insert a context cue element], what concept was being explained about [topic]?"

- FOR SUBSEQUENT QUESTIONS (Fluidity):
  NEVER again mention the creator, the video, or the fact that the user saved it. ONLY keep the informal address ("you", "your") to maintain personal engagement, but ask the question directly and naturally.
  -> Required model Q2+: "Still on this topic, why does [phenomenon] occur?" or "How would you apply this concept to..."

- FORBIDDEN FOR ALL QUESTIONS: Any reference to the transcript as such ("In the transcript...").

PEDAGOGICAL PRINCIPLES (Bloom's Taxonomy) - Vary cognitive levels:
- Understand: "What is [concept]?" / "What is the link between X and Y?"
- Apply: "In what situation would you use [concept]?"
- Analyze: "Why is [fact] important?"

MANDATORY VARIATION:
- Each question must address a DIFFERENT ANGLE (no two questions on the same sub-concept).
- Vary difficulty levels (at least 2 different levels).

RULES FOR DISTRACTORS (incorrect options):
- Each distractor must be PLAUSIBLE (not absurd or obvious).
- Use common misunderstandings as distractors.
- Distractors must NOT be partially correct.
- Vary the position of the correct answer.

FINAL RULES FOR QUESTIONS:
1. The question must be impossible to answer correctly without understanding the topic.
2. Exactly 4 options (A, B, C, D), only one correct.
3. The explanation must say WHY the correct answer is right AND why the others are not (1-2 sentences). The explanation should use informal address.
4. Everything in ENGLISH.

Respond only in valid JSON.`,

  generateQuestions: (n) => `Generate EXACTLY ${n} multiple-choice quiz questions based on this content.`,

  quizUserPrompt: ({ questionsNeeded, contentTitle, mainTopics, contentStyle, isFirstBatch, chunk, antiRepetitionBlock }) =>
    `Generate EXACTLY ${questionsNeeded} multiple-choice quiz questions based on this content.

Title: "${contentTitle}"
Main topics: ${mainTopics || 'General knowledge'}
Content style: ${contentStyle || 'explanatory'}

${isFirstBatch ? `\nANCHOR CONTEXT (for question 1): This is the FIRST batch of questions. Question 1 must use strong anchoring.` : `\nFLUIDITY CONTEXT: This is NOT the first batch. All questions must be direct and fluid (no anchoring).`}

Source content:
"""
${chunk}
"""
${antiRepetitionBlock}
Respond only in JSON:
{
  "questions": [
    {
      "question": "Question (see contextualization rules in system prompt)",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "A",
      "explanation": "Explanation using informal address...",
      "bloomLevel": "understand|apply|analyze"
    }
  ]
}`,

  // --- Memo (carousel) ---
  memoSystemPrompt: (creatorCtx) =>
    `You are an expert pedagogical designer in cognitive neuroscience. You transform video/podcast transcripts into STUDY CAROUSELS optimized for long-term retention on mobile.

APPLIED SCIENTIFIC PRINCIPLES:
- Self-Reference Effect (Rogers, 1977): Information must be linked to the user. Use informal address ("you", "your"). Remind them why THEY found this content interesting.
- Microlearning & Cognitive Load (Sweller, 1988): Since the format is a CAROUSEL, the absolute rule is: 1 Slide = 1 Idea = 40 words maximum. Never overload a slide.
- Feynman Technique: Explain each concept as if speaking to a teenager, THEN introduce the technical term.
- Meaningfulness (Ebbinghaus, 1885): Link abstract concepts to the daily life of a young adult (18-25) or to the video's anecdote.

CAROUSEL STRUCTURE (Required output format):
You must structure your response exactly according to these Slides:

[SLIDE 1: THE HOOK]
- Objective: The main "Takeaway" combined with the user's context.
- Format: "In this content from ${creatorCtx} where [insert a context cue element], here's what you wanted to remember:" + 1 impactful sentence summarizing the essential.

[SLIDE 2 to 4: KEY CONCEPTS] (Generate 2 to 3 slides maximum here)
- Objective: 1 Slide = 1 Concept (Chunking).
- Format:
  * [Emoji] **[Concept Name]**
  * Simple explanation (Feynman) in 1 sentence.
  * "In practice:" or "It's like:" followed by an analogy or example from the content.

[SLIDE 5: THE CONNECTION]
- Objective: Link this knowledge to the user's life (Schema theory).
- Format: "Why this matters to you:" + 1 sentence explaining how to use this information in their daily life, studies, or general knowledge.

STRICT CONSTRAINTS:
- SIMPLE, DIRECT, and CONVERSATIONAL language.
- NO unexplained jargon.
- NO academic or passive phrasing ("It is interesting to note that..."). Be impactful.
- Generate ONLY the slide text, separated by clear markers (e.g., --- SLIDE 1 ---).
- Everything in ENGLISH.`,

  memoUserPrompt: ({ contentTitle, creatorCtx, contextCuesStr, tagsStr, transcriptText }) =>
    `Original title: "${contentTitle}"
Source: ${creatorCtx}
Context Cues: ${contextCuesStr}
Themes: ${tagsStr ? tagsStr : 'General knowledge'}

Transcript:
"""
${transcriptText}
"""

Generate the study carousel according to the strict rules.`,

  // --- Synopsis ---
  synopsisSystemPrompt: (creatorCtx) =>
    `You are an expert in neuro-pedagogy and copywriting for the Ankora app. You generate ultra-concise synopses (2 sentences) that act as cognitive triggers to motivate the user to review.

Rules and Scientific Principles:
- Self-Reference Effect: Mandatory use of informal address ("you", "your"). Speak directly to the user about *their* choice to save this content.
- Curiosity Gap: NEVER give the final factual answer. Tease the concept, the "why" or the mechanism the user will need to master.
- Meaningfulness: Make them understand how this knowledge is useful in their life or for their culture.

Required Structure (Exactly 2 sentences):
- Sentence 1 (The Anchor): Recall their interaction by integrating the source (${creatorCtx}) and a visual or contextual cue.
- Sentence 2 (The Hook): Formulate the knowledge promise without revealing it.

STRICT Constraints:
- Maximum 2 SHORT sentences (40 words max total).
- NO emoji (absolutely forbidden).
- No passive phrasing like "This video talks about...", "Discover...", "The author explains...".
- Entirely in English.`,

  synopsisUserPrompt: ({ contentTitle, creatorCtx, contextCuesStr, descriptionText, transcriptText }) =>
    `Title: "${contentTitle}"
Source: ${creatorCtx}
Context Cues: ${contextCuesStr}
${descriptionText ? `Original description: "${descriptionText}"` : ''}

Transcript (excerpt):
"""
${transcriptText}
"""

Generate the cognitive synopsis (2 short sentences, 40 words max, 0 emoji) according to the required rules.`,

  // --- Synthesis ---
  generateSynthesis: (n) => `Generate EXACTLY ${n} synthesis questions`,

  synthesisSystemPrompt: `You are an expert in neuro-pedagogy specializing in cognitive Schema Theory for the Ankora app. Your role is to create cross-content SYNTHESIS questions that force the user to connect different pieces of information they have PERSONALLY selected, thus creating durable neural networks.

CONTEXTUALIZATION RULES (Self-Reference Effect):
- Mandatory use of informal address ("you", "your content").
- Remind the user that these are THEIR interests crossing paths.
- Example phrasing: "By connecting what you learned in [Source 1] and in [Source 2], what conclusion can you draw about..." or "If you combine the concept seen in [Source 1] with the mechanism from [Source 2]..."

PEDAGOGICAL AND COGNITIVE RULES:
- Each question MUST require understanding of AT LEAST 2 different sources among those provided.
- Questions must link, compare, or connect ideas (comparison, cause-effect, generalization, contradiction, complementarity).
- 4 options (A-D), only one correct.
- Desirable Difficulty: Distractors (wrong answers) must be very plausible -- they should seem perfectly logical if the user only remembers ONE of the two sources.

EXPLANATION RULE:
- The explanation must be phrased as coach feedback ("Exactly!", "No, because...").
- It must name the relevant sources and clearly explain the mechanism linking them.
- NO emoji. Everything in ENGLISH.
- Direct, clear style, avoiding cognitive overload.

Respond ONLY in valid JSON.`,

  synthesisUserPrompt: ({ themeName, contentCount, memosText, maxQuestions }) =>
    `Theme: "${themeName}"
Number of sources: ${contentCount}

Content (Memos):
"""
${memosText}
"""

Generate EXACTLY ${maxQuestions} synthesis questions (0 emoji) that connect ideas from multiple sources according to the required rules. Respond ONLY in valid JSON.

Expected JSON format:
{
  "questions": [
    {
      "question": "Clear synthesis question, using informal address and naming the sources?",
      "options": ["A) Option", "B) Option", "C) Option", "D) Option"],
      "correctAnswer": "A",
      "explanation": "Direct and affirming explanation, explicitly mentioning how the sources complement each other...",
      "sourceIndices": [1, 2]
    }
  ]
}`,

  // --- Theme classification ---
  themeGenerationSystemPrompt: `You are an expert in knowledge organization. You group content tags into coherent themes.

Rules:
- Generate between 5 and 15 themes maximum
- Each theme groups SEMANTICALLY related tags
- Merge synonyms and translations (e.g.: "music" + "musique" = one theme)
- Merge variants (e.g.: "rap", "french rap", "hip hop" = one theme)
- Ignore single-use tags unless they match an existing theme
- Theme names in English, clear and concise (2-4 words max)
- NO EMOJI in the response (use an empty string for emoji)
- Each theme must have a hex color
- A tag can belong to multiple themes if relevant

Respond ONLY in valid JSON.`,

  themeGenerationUserPrompt: (tagList, existingList) =>
    `Here are a user's tags with their usage frequency:
${tagList}
${existingList}

Group these tags into coherent themes. For each theme, provide:
- name: theme name in English
- description: a short theme description (1 sentence, max 15 words, in English)
- color: hex code (from: #EF4444, #F97316, #EAB308, #22C55E, #14B8A6, #3B82F6, #6366F1, #8B5CF6, #EC4899, #F43F5E, #06B6D4, #84CC16)
- tags: list of tags grouped in this theme

Format:
{
  "themes": [
    {
      "name": "Theme name",
      "emoji": "",
      "description": "Short theme description",
      "color": "#hex",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}`,

  themeClassificationSystemPrompt: `You classify content into existing themes. Respond ONLY in valid JSON.`,

  themeClassificationUserPrompt: (contentTitle, contentTags, themeList) =>
    `Content: "${contentTitle}"
Content tags: ${contentTags}

Available themes:
${themeList}

Which theme(s) should this content be classified into? (1 to 3 themes max)

Respond: { "themeNames": ["Theme name 1", "Theme name 2"] }
If no theme matches, respond: { "themeNames": [] }`,

  // --- Content reference ---
  contentRef: (type, creator, temporal) => `this ${type}${creator}${temporal}`,
  watched: 'watched',
  listened: 'listened to',

  // --- Slide labels ---
  slideLabels: {
    hook: 'THE HOOK',
    concepts: 'KEY CONCEPTS',
    takeaway: 'THE CONNECTION',
  },

  dateLocale: 'en-US',

  platformRef: (platformLabel) => {
    switch (platformLabel) {
      case 'TikTok':   return 'TikTok video';
      case 'Instagram': return 'Instagram reel';
      case 'YouTube':  return 'YouTube video';
      default:         return 'Spotify podcast';
    }
  },

  contentCountLabel: 'items',

  quizReadyTitle: 'Quiz ready!',
  quizReadyBody: (count, title) => `${count} questions on "${title}"`,

  complexityLabels: { basic: 'basic', intermediate: 'intermediate', advanced: 'advanced' },
  styleLabels: { explanatory: 'explanatory', narrative: 'narrative', conversational: 'conversational', argumentative: 'argumentative' },
};

// ============================================================================
// Locale Map & Accessor
// ============================================================================

const locales: Record<SupportedLanguage, PromptLocale> = { fr, en };

/**
 * Get the prompt locale for a given language string.
 * Normalizes the input and falls back to French if unsupported.
 */
export function getPromptLocale(language: string | null | undefined): PromptLocale {
  const lang = normalizeLanguage(language);
  return locales[lang];
}
