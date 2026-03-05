# Evidence-Based Principles for Writing Study Memos

## A Research-Backed Guide for Generating Effective Learning Notes from Video/Podcast Transcripts

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Science of Memory and Retention](#the-science-of-memory-and-retention)
3. [12 Evidence-Based Learning Techniques](#12-evidence-based-learning-techniques)
4. [Wozniak's 20 Rules of Formulating Knowledge](#wozniaks-20-rules-of-formulating-knowledge)
5. [Anki Community Best Practices for Card Design](#anki-community-best-practices-for-card-design)
6. [The Cornell Note-Taking Method](#the-cornell-note-taking-method)
7. [What Makes a Good Memo vs a Bad Memo](#what-makes-a-good-memo-vs-a-bad-memo)
8. [AI-Generated Study Summaries: Best Practices](#ai-generated-study-summaries-best-practices)
9. [Actionable Principles for Ankora Memo Generation](#actionable-principles-for-ankora-memo-generation)
10. [Sources](#sources)

---

## Executive Summary

Decades of cognitive psychology research converge on a clear finding: **learning that feels effortful produces the strongest, most durable memories**. The most effective study materials are those that force the learner to actively retrieve, generate, and connect information -- not passively re-read it.

The two highest-rated learning strategies according to Dunlosky et al.'s landmark 2013 meta-analysis of hundreds of studies are:
- **Practice testing** (self-quizzing / retrieval practice)
- **Distributed practice** (spaced repetition)

Additional strategies with strong-to-moderate evidence: **elaborative interrogation**, **interleaving**, **concrete examples**, **dual coding**, and the **generation effect**.

The least effective strategies -- despite being the most popular among students -- are **highlighting** and **re-reading**.

This document synthesizes findings from peer-reviewed research, the spaced repetition community (SuperMemo, Anki), and practical AI-summarization workflows into actionable principles for generating study memos from video and podcast transcripts.

---

## The Science of Memory and Retention

### The Forgetting Curve (Ebbinghaus, 1885)

Hermann Ebbinghaus discovered that memory decays exponentially after initial learning. Without review:
- **20 minutes**: ~42% forgotten
- **1 hour**: ~56% forgotten
- **1 day**: ~67% forgotten
- **1 week**: ~75% forgotten
- **1 month**: ~79% forgotten

Each well-timed review "resets" the curve and extends the interval before the next forgetting onset. This is the scientific foundation of spaced repetition.

### The Spacing Effect

Hundreds of studies demonstrate that spacing out repeated encounters with material over time produces superior long-term learning compared to massed repetition (cramming). Spaced repetition reduces study time by **50-70%** compared to traditional methods while maintaining or improving retention.

### Desirable Difficulties (Bjork, 1994)

Robert Bjork coined the term "desirable difficulties" to describe learning conditions that make encoding harder in the moment but produce stronger long-term retention. The four primary desirable difficulties are:
1. **Spacing** (vs. massing) study sessions
2. **Interleaving** (vs. blocking) topics
3. **Testing** (vs. re-reading) as a study event
4. **Generating** (vs. being presented) answers

**Critical caveat**: Not all difficulty is desirable. Learners must have sufficient background knowledge to overcome the difficulty. Confusion without scaffolding is counterproductive.

---

## 12 Evidence-Based Learning Techniques

### 1. Spaced Repetition

**What it is**: Reviewing material at increasing intervals over time, calibrated to the point just before forgetting.

**The evidence**: The SM-2 algorithm (Piotr Wozniak, 1987) formalized this into software. After 12 weeks, average 30-day retention reaches 79-82% with spaced repetition vs. near-zero with cramming. SM-2 adapts to individual performance: difficult items appear more frequently, easy items have longer intervals.

**How it works in practice**:
- First review: 1 day after learning
- Second review: ~3 days
- Third review: ~7 days
- Fourth review: ~14 days
- Each successful recall extends the interval by a factor (typically 2.5x in SM-2)

**For memo design**: Structure memos so each key concept can be independently scheduled for review. Self-contained atomic units > monolithic summaries.

---

### 2. Active Recall (The Testing Effect)

**What it is**: Pulling information out of memory without looking at source material, rather than passively re-reading.

**The evidence**: Roediger & Karpicke (2006) -- the landmark study. Students who practiced recall retained **80% of material** after one week, compared to **34%** for those who re-read. Dunlosky et al. (2013) rated practice testing as one of only two "high utility" learning techniques.

**Key finding**: Self-testing is superior even when no feedback is given, and even though re-study exposes learners to ALL the material while testing only exposes them to what they can recall.

**For memo design**: Memos should contain questions, not just statements. Every key fact should be paired with a prompt that requires the learner to produce the answer from memory.

---

### 3. Elaborative Interrogation

**What it is**: Asking "why" and "how" questions about facts to generate explanations that connect new info to existing knowledge.

**The evidence**: Students using elaborative interrogation remembered **72% of facts** -- nearly double the retention of passive readers (Dunlosky et al., 2013: moderate utility). The technique improves both retention and transfer to new contexts.

**How vs. Why**: "Why" questions require inferential reasoning and hypothesis formation. "How" questions require understanding mechanisms and processes. Both deepen encoding beyond surface-level memorization.

**For memo design**: For every key claim in a transcript, generate a "Why is this true?" or "How does this work?" question. The answer should connect the fact to broader principles or the learner's existing knowledge.

---

### 4. Dual Coding Theory (Paivio, 1971)

**What it is**: Processing information through both verbal AND visual channels simultaneously creates two independent memory traces, doubling retrieval pathways.

**The evidence**: Butcher (2006) meta-analysis: combining text with relevant diagrams improved comprehension by **0.48 standard deviations**. Mayer (2009): multimedia instruction following dual coding principles improved transfer test performance by **89%** over text-only.

**Core principle**: A memory stored in both visual and verbal systems has a better chance of being retained and retrieved than one stored in only one system.

**For memo design**: Pair verbal explanations with diagrams, timelines, concept maps, or visual metaphors when possible. Even simple visual layouts (bullet hierarchies, tables, spatial grouping) engage the visual channel.

---

### 5. Chunking (Miller, 1956)

**What it is**: Grouping individual pieces of information into meaningful units ("chunks") to bypass working memory's capacity limit of 7 +/- 2 items.

**The evidence**: George Miller's foundational research showed that working memory can hold approximately 5-9 chunks. By encoding multiple raw data points into one recognizable chunk, cognitive load is dramatically reduced, allowing significantly more information to be held in immediate awareness.

**Example**: The number 1-9-4-5-0-8-1-5 (8 digits) becomes 1945-0815 (2 chunks: end of WWII, August 15th).

**For memo design**: Group related facts under meaningful headings. Use acronyms, categories, and hierarchical structures. Never present more than 3-5 related items without organizing them into a higher-level chunk.

---

### 6. The Feynman Technique

**What it is**: A 4-step method that tests understanding by requiring simple explanation.

**The four steps**:
1. **Select a concept** -- write everything you know about it
2. **Explain it to a 12-year-old** -- use simple language, no jargon. If you cannot simplify, you do not understand.
3. **Identify gaps and return to source** -- where your explanation breaks down reveals what you do not actually understand
4. **Simplify further and teach** -- compress, use analogies, test by teaching someone else

**Core insight**: "Complexity and jargon often mask a lack of understanding." True learning means grasping essence, not memorizing terminology.

**For memo design**: Write memo explanations in plain language. If a concept from the transcript requires jargon, provide a simple analogy first, then introduce the technical term. The memo should be understandable by someone with no domain expertise.

---

### 7. Schema Theory (Piaget, Bartlett, Anderson)

**What it is**: Learners organize knowledge into mental frameworks ("schemas"). New information is either assimilated into existing schemas or forces accommodation (restructuring existing schemas).

**The evidence**: Learners who can relate new knowledge to their existing schemas are significantly more likely to understand and retain it. Advanced organizers that connect new concepts to what learners already know dramatically improve engagement and knowledge transfer.

**Two key processes**:
- **Assimilation**: Fitting new info into pre-existing mental structures
- **Accommodation**: Restructuring existing mental models to incorporate genuinely new information

**For memo design**: Always anchor new concepts to familiar ones. Use analogies ("X is like Y, except..."). Explicitly state how the new information relates to, extends, or contradicts what the learner likely already knows.

---

### 8. Bloom's Taxonomy (Revised 2001)

**What it is**: A hierarchy of six cognitive levels, from shallow to deep understanding:

| Level | Verb | Description | Question Type |
|-------|------|-------------|---------------|
| 1. Remember | Recall, list, define | Retrieve facts from memory | "What is X?" |
| 2. Understand | Explain, summarize, paraphrase | Construct meaning | "Explain X in your own words" |
| 3. Apply | Use, implement, solve | Apply knowledge to new situations | "How would you use X to solve Y?" |
| 4. Analyze | Compare, differentiate, organize | Break down into components | "How does X differ from Y?" |
| 5. Evaluate | Judge, critique, justify | Make informed judgments | "Is X better than Y? Why?" |
| 6. Create | Design, construct, produce | Synthesize into something new | "Design a solution using X" |

**Key insight**: Most study materials only test levels 1-2 (Remember and Understand). The most durable and transferable learning requires reaching levels 3-6.

**For memo design**: Generate questions at MULTIPLE Bloom's levels for each key concept. Do not stop at "What is X?" -- push to "Why does X matter?", "How would you apply X?", "How does X compare to Y?"

---

### 9. Concrete Examples

**What it is**: Illustrating abstract concepts with specific, tangible instances from real life.

**The evidence**: Finn, Thomas & Rawson (2018): elaborating on concepts with concrete examples enhanced both retention and application. Concrete examples are one of the six cognitive strategies with the most robust research support (alongside spaced practice, interleaving, retrieval practice, elaboration, and dual coding).

**Key finding**: Concrete examples do not just help learners remember the examples -- they enhance retention of the broader abstract concepts the examples illustrate.

**For memo design**: Every abstract principle should be paired with at least one concrete, relatable example. Prefer examples from the learner's domain of interest (e.g., pop culture, their profession, daily life).

---

### 10. Interleaving

**What it is**: Mixing different topics or problem types during study instead of studying one topic at a time (blocking).

**The evidence**: Rohrer & Taylor (2007): interleaved practice produced **43% better performance** on delayed tests. A physics study showed **50-125% improvement** on tests after interleaved practice. Interleaving leads to better long-term retention AND improved ability to transfer learned knowledge to new situations.

**Why it feels wrong**: Students rate interleaving as more difficult and incorrectly believe they learn less from it. This is the "desirable difficulty" -- the harder retrieval process builds stronger memory traces.

**Important caveat**: Works best when concepts are related enough to form meaningful connections, yet distinct enough to require active discrimination.

**For memo design**: When generating memos from multiple pieces of content, mix questions across topics in review sessions rather than grouping all questions from one video together.

---

### 11. The Generation Effect (Slamecka & Graf, 1978)

**What it is**: Information is remembered significantly better when it is generated (produced) by the learner rather than simply read or presented.

**The evidence**: Slamecka & Graf's original experiment showed students who completed word stems (hot-c___) remembered significantly more than those who read complete word pairs (hot-cold). fMRI studies show the generation condition produced a hit rate **22% greater** than reading (87% vs. 65%). The effect replicates across foreign language learning, mathematical problem-solving, vocabulary, and more.

**Why it works**: Generation activates multiple cognitive processes -- semantic elaboration, distinctive processing, and effortful retrieval -- creating more retrieval pathways and stronger memory traces.

**For memo design**: Rather than presenting all answers, leave strategic gaps for the learner to fill. Use cloze deletions. Ask the learner to predict, infer, or construct answers before revealing them.

---

### 12. Self-Explanation Effect

**What it is**: A variant of elaborative interrogation where learners explain TO THEMSELVES why steps or facts are true.

**The evidence**: Chi et al. (1989) showed that students who spontaneously self-explained while studying solved problems significantly better than those who did not. Self-explanation promotes deeper processing, identifies misconceptions, and strengthens connections between new and existing knowledge.

**For memo design**: Include prompts like "In your own words, why does this matter?" or "How does this connect to what you already know about X?" Self-explanation prompts are especially valuable after presenting a complex mechanism or argument.

---

## Wozniak's 20 Rules of Formulating Knowledge

Dr. Piotr Wozniak (creator of SuperMemo, the first spaced repetition software) published these rules in 1999. They remain the gold standard for formulating material for long-term retention.

### The Rules (Condensed)

| # | Rule | Key Insight |
|---|------|-------------|
| 1 | **Do not learn what you do not understand** | Comprehension must precede memorization. Memorizing without understanding wastes time and produces useless knowledge. |
| 2 | **Learn before you memorize** | Build the big picture first. Read the whole chapter before isolating individual facts. |
| 3 | **Build upon the basics** | Start with simple foundational models. Basics require minimal repetition time but anchor everything complex. |
| 4 | **Stick to the minimum information principle** | Make items as simple as possible. Simple = consistent neural pathways = clear memory traces. One question, one fact. |
| 5 | **Cloze deletion is easy and effective** | Sentences with blanks are fast to create and highly effective. "The [capital] of France is Paris" -> "The ___ of France is Paris." |
| 6 | **Use imagery** | Visual cortex processing exceeds verbal. One picture is worth a thousand words for anatomy, geography, etc. |
| 7 | **Use mnemonic techniques** | Mind maps, peg lists, acronyms make initial memorization dramatic. But they do not solve long-term retention alone. |
| 8 | **Graphic deletion works like cloze deletion** | Cover parts of images and ask "What is hidden?" Reuse one image across 10-20 items. |
| 9 | **Avoid sets** | Never ask "List all the X." Sets are nearly impossible to memorize beyond 5 items. Convert to ordered groups or individual items. |
| 10 | **Avoid enumerations** | Ordered lists are slightly better than sets but still difficult. Use overlapping cloze deletions to learn sequences. |
| 11 | **Combat interference** | Similar items confuse memory. Maximize unambiguity, apply minimum information principle, eliminate interference on detection. |
| 12 | **Optimize wording** | Refine language to activate correct neural responses in minimum time. Eliminate redundant information. |
| 13 | **Refer to other memories** | Place items within existing memory networks to reduce interference and simplify wording. |
| 14 | **Personalize and provide examples** | Link to personal experience. Items with personal examples can be forgotten 0 times over 5 years vs. 20 times/year without. ~25x time savings. |
| 15 | **Rely on emotional states** | Vivid, emotionally charged examples enhance recall. Emotional associations resist interference. |
| 16 | **Context cues simplify wording** | Use categories and labels to establish context, enabling simpler item language. |
| 17 | **Redundancy does not contradict minimum information** | Viewing knowledge from multiple angles (passive/active, different representations) is strategic, not wasteful. |
| 18 | **Provide sources** | Attribute knowledge to sources. Enables defense, comparison, and updates. |
| 19 | **Provide date stamping** | Tag volatile information with dates. Statistical data, software versions, etc. |
| 20 | **Prioritize** | Not all knowledge is equal. Extract and formulate high-impact components. Focus retention effort on what matters most. |

### The Unifying Theme

All 20 rules serve **simplicity**. The speed of learning depends on how material is formulated. The same material can be learned many times faster when well formulated.

---

## Anki Community Best Practices for Card Design

### The "EAT" Framework

- **E - Encoded**: Only make flashcards from things you have ALREADY learned. Anki is a retention tool, not a learning tool.
- **A - Atomic**: Each card tests exactly one thing. Vague prompts generate multiple possible answers and slow recall.
- **T - Timeless**: Cards must be comprehensible to your future self months or years later. No cryptic abbreviations.

### Six Rules for Precise Cards

1. **Questions should ask exactly one thing** (Minimum Information Principle)
2. **Questions should permit exactly one answer** -- avoid ambiguity, the "example trap" ("X is an example of ___" is better than "Give an example of X"), and multiple interpretations
3. **Questions should NOT ask you to enumerate** -- "Name all the..." is frustrating and ineffective. Learn items individually.
4. **Questions should NOT ask for yes/no answers** -- these are harder to remember and less useful. Rephrase to require specific content.
5. **Questions should be context-free** -- state the topic early, do not reference specific sources ("According to the textbook...")
6. **Why-based questions > factual questions** -- "Why does X have property Y?" is more valuable than "What property does X have?"

### The 10-Second Rule

If you cannot answer a card within 10 seconds, it is probably too complex. Split it.

### Card Types by Use Case

| Card Type | Best For |
|-----------|----------|
| Basic (Q&A) | Facts, definitions, single-point knowledge |
| Cloze deletion | Sentences with key terms, sequences |
| Image occlusion | Diagrams, anatomy, geography |
| Reversed cards | Vocabulary, bidirectional knowledge |

### The #1 Mistake

Creating cards before understanding the source material. **Learn first, then memorize.**

---

## The Cornell Note-Taking Method

Developed by Walter Pauk (Cornell University, 1950s). Structures notes to build in active recall and synthesis.

### The Layout

```
+-------------------+----------------------------------------+
|                   |                                        |
|   CUE COLUMN      |         NOTE-TAKING COLUMN             |
|   (1/3 width)     |         (2/3 width)                    |
|                   |                                        |
|   Questions,      |   Main ideas, key facts,               |
|   keywords,       |   explanations from the                |
|   prompts         |   lecture/video/podcast                 |
|                   |                                        |
|   (written AFTER  |   (written DURING                      |
|    the lecture)   |    the lecture)                         |
|                   |                                        |
+-------------------+----------------------------------------+
|                                                            |
|                    SUMMARY                                  |
|   (written after: 2-3 sentence synthesis of the page)      |
|                                                            |
+------------------------------------------------------------+
```

### The 5 R's Process

1. **Record**: During the lecture/video, write main ideas and facts in the note-taking column
2. **Reduce**: After, distill key points into cue-column questions and keywords
3. **Recite**: Cover the right column. Use cues to verbally recall the content. (Active recall!)
4. **Reflect**: Consider how this connects to what you already know. (Schema theory!)
5. **Review**: Spend 10 minutes reviewing notes within 24 hours, then at spaced intervals

### Why It Works

The layout forces active recall (cover right column, answer from cues), elaboration (generating questions), and synthesis (writing summaries). It combines multiple evidence-based techniques into one system.

---

## What Makes a Good Memo vs a Bad Memo

### Bad Memo Characteristics

| Problem | Why It Fails | Cognitive Basis |
|---------|-------------|-----------------|
| Verbatim transcript copy | No processing, no encoding | Generation effect: producing > reading |
| Wall of unstructured text | Overwhelms working memory | Chunking: must be organized into groups |
| Only facts, no questions | Encourages re-reading, not recall | Testing effect: recall > re-reading |
| Jargon without explanation | Cannot be understood = cannot be learned | Wozniak Rule #1: never learn what you do not understand |
| No examples | Abstract info has fewer retrieval cues | Concrete examples: anchor abstract to tangible |
| No connections to prior knowledge | Isolated facts are fragile | Schema theory: connected knowledge persists |
| Tests only "Remember" level | Shallow encoding, no transfer | Bloom's: must reach Apply/Analyze/Evaluate |
| Everything presented as equally important | No prioritization, wasted effort | Wozniak Rule #20: prioritize ruthlessly |

### Good Memo Characteristics

| Quality | Why It Works | Cognitive Basis |
|---------|-------------|-----------------|
| **Chunked into atomic sections** | Respects working memory limits | Chunking (Miller) |
| **Each section has a clear question** | Forces active recall during review | Testing effect (Roediger & Karpicke) |
| **Simple language, no unnecessary jargon** | Ensures understanding precedes memory | Feynman technique |
| **Concrete examples for each concept** | Multiple retrieval pathways | Concrete examples research |
| **"Why" and "How" questions included** | Deeper processing and connection | Elaborative interrogation |
| **Visual elements (tables, diagrams, hierarchies)** | Dual encoding in verbal + visual | Dual coding (Paivio) |
| **Connections to familiar concepts** | Activates existing schemas | Schema theory (Piaget) |
| **Questions at multiple Bloom's levels** | Ensures deep, transferable understanding | Bloom's taxonomy |
| **Key terms highlighted, rest simplified** | Focuses attention on high-value info | Wozniak: optimize wording |
| **Personal relevance noted** | Emotional and personal hooks resist forgetting | Wozniak Rule #14-15 |

---

## AI-Generated Study Summaries: Best Practices

### The Fundamental Tension

AI summaries are powerful for **efficiency** but can undermine learning if they replace the cognitive effort that produces retention. The goal is to use AI to scaffold and structure, while preserving the learner's need to actively engage.

### Principles for AI-Generated Memos

1. **AI summary is a starting point, not the final product** -- the learner should annotate, question, and extend it
2. **Always generate questions, not just statements** -- transform passive summaries into active recall prompts
3. **Include strategic gaps** -- leverage the generation effect by leaving blanks for learners to fill
4. **Provide multiple levels of depth** -- a quick summary AND detailed explanations AND self-test questions
5. **Flag uncertainty** -- if the AI is unsure about a point from the transcript, mark it for the learner to verify
6. **Maintain source attribution** -- link back to timestamps or specific parts of the transcript
7. **Use structured formats** -- Cornell-style layouts, tables, and hierarchies engage dual coding
8. **Personalization prompts** -- ask the learner to connect the material to their own experience

### Workflow for Transcript -> Memo

```
TRANSCRIPT (raw content)
    |
    v
EXTRACTION (identify key claims, arguments, examples, definitions)
    |
    v
CHUNKING (group into 3-7 thematic sections)
    |
    v
SIMPLIFICATION (plain language, Feynman-level explanations)
    |
    v
ENRICHMENT (add examples, analogies, connections to prior knowledge)
    |
    v
QUESTION GENERATION (multiple Bloom's levels per section)
    |
    v
FORMATTING (visual structure, dual coding, Cornell-inspired layout)
    |
    v
PRIORITIZATION (mark must-know vs. nice-to-know)
```

---

## Actionable Principles for Ankora Memo Generation

Based on all the research above, here are the concrete principles that should guide how Ankora generates study memos from video and podcast transcripts.

### Architecture Principles

1. **Separate learning from memorization**: The memo teaches (big picture, context, explanations). The quiz tests (atomic recall, spaced repetition). They are complementary, not redundant.

2. **Chunk ruthlessly**: Break every transcript into 3-7 thematic sections. Each section should cover ONE coherent idea. Title each section with a clear heading.

3. **Pyramid structure**: Start each section with the simplest explanation (Feynman-level), then add complexity. The first sentence should be understandable by a 12-year-old.

4. **Prioritize visibly**: Mark the 2-3 most important takeaways distinctly. Not all content is equal -- help the learner focus on what matters most.

### Content Principles

5. **Explain "why" before "what"**: For every key claim, provide the reasoning or mechanism. "Spaced repetition works because..." is more valuable than "Spaced repetition is a technique where..."

6. **Concrete over abstract**: Every abstract principle gets at least one concrete example, ideally from the content itself (a story the speaker told, a case study mentioned).

7. **Connect to existing knowledge**: Use analogies and comparisons. "This is similar to..." or "Unlike X, this works by..." Activate the learner's schemas.

8. **Simple language first, jargon second**: Introduce concepts in plain language, then provide the technical term. Never the reverse.

### Question Design Principles

9. **Every section generates questions**: At minimum, each section should produce:
   - 1 factual recall question (Bloom's: Remember)
   - 1 comprehension question (Bloom's: Understand)
   - 1 application or analysis question (Bloom's: Apply/Analyze)

10. **Atomic questions only**: One question = one fact. Never "Describe everything about X." Always "What is the key mechanism behind X?"

11. **No yes/no questions**: Replace "Is X true?" with "What is X?" or "Why does X happen?"

12. **No enumeration questions**: Replace "List all the benefits of X" with individual questions about each benefit, or "What is the PRIMARY benefit of X?"

13. **Include cloze-style prompts**: "The [spacing effect] means that distributing practice over time produces ___ long-term retention than cramming." (Answer: better/superior)

### Formatting Principles

14. **Use tables for comparisons**: Whenever two or more things are compared, use a table. Tables engage dual coding and make relationships explicit.

15. **Use hierarchical structure**: Headings > subheadings > bullet points. Never a flat wall of text.

16. **Bold key terms on first appearance**: Visual anchoring helps the eye and the memory.

17. **Include a 2-3 sentence "essence" at the top**: The single most important takeaway, before any detail. If the learner reads nothing else, they get this.

### Emotional/Personal Principles

18. **Relate to real life when possible**: "Next time you [common situation], remember that [concept]."

19. **Use the speaker's own stories and examples**: Transcripts from podcasts and videos often contain personal anecdotes -- these are gold for emotional encoding.

20. **Mark surprising or counterintuitive findings**: Flag "Most people think X, but research shows Y" -- surprise enhances encoding.

---

## Research Evidence Summary Table

| Technique | Utility Rating (Dunlosky 2013) | Key Effect Size | Best For |
|-----------|-------------------------------|-----------------|----------|
| Practice Testing | HIGH | 80% vs 34% retention at 1 week | Quiz questions, self-testing |
| Distributed Practice (Spacing) | HIGH | 50-70% less study time needed | Review scheduling |
| Elaborative Interrogation | MODERATE | 72% vs ~40% retention | "Why/how" questions |
| Interleaving | MODERATE | 43% better on delayed tests | Mixing topics in review |
| Self-Explanation | MODERATE | Significant problem-solving gains | Prompting personal reflection |
| Concrete Examples | STRONG (6 strategies) | Enhanced retention + transfer | Illustrating abstract ideas |
| Dual Coding | STRONG (Mayer) | 89% better transfer performance | Visual + verbal pairing |
| Generation Effect | STRONG (fMRI) | 87% vs 65% hit rate | Fill-in-the-blank, cloze |
| Testing Effect | STRONG (Roediger) | 2.3x retention at 1 week | Quizzes over re-reading |
| Chunking | FOUNDATIONAL | 7+/-2 limit bypass | Organizing information |
| Highlighting/Re-reading | LOW | Minimal benefit | AVOID as primary strategy |

---

## Sources

### Spaced Repetition and SM-2
- [SM-2 Algorithm Explained: The Science Behind Spaced Repetition](https://tegaru.app/en/blog/sm2-algorithm-explained)
- [Spaced Repetition - Wikipedia](https://en.wikipedia.org/wiki/Spaced_repetition)
- [FSRS: Spaced Repetition Algorithm Journey](https://github.com/open-spaced-repetition/fsrs4anki/wiki/spaced-repetition-algorithm:-a-three%E2%80%90day-journey-from-novice-to-expert)
- [The Power of Spaced Repetition and Flashcards - Ness Labs](https://nesslabs.com/spaced-repetition)
- [The Anki SM-2 Spaced Repetition Algorithm - RemNote](https://help.remnote.com/en/articles/6026144-the-anki-sm-2-spaced-repetition-algorithm)

### Active Recall and Testing Effect
- [Active Recall: The Most Effective High-Yield Learning Technique - Osmosis](https://www.osmosis.org/blog/active-recall-the-most-effective-high-yield-learning-technique)
- [Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention - Roediger & Karpicke (PubMed)](https://pubmed.ncbi.nlm.nih.gov/16507066/)
- [The Power of Testing Memory - Roediger & Karpicke (2006)](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PPS.pdf)
- [Active Recall Strategies and Academic Achievement (PubMed)](https://pubmed.ncbi.nlm.nih.gov/38461899/)
- [How To Study: Active Recall - Ali Abdaal](https://aliabdaal.com/studying/how-to-study-active-recall-the-high-utility-technique-you-should-be-using/)
- [The Testing Effect: How Retrieval Practice Strengthens Learning](https://www.structural-learning.com/post/testing-effect-retrieval-practice)

### Elaborative Interrogation
- [Elaborative Interrogation - Wikipedia](https://en.wikipedia.org/wiki/Elaborative_interrogation)
- [Elaborative Interrogation: Enhance Learning by Asking Why - Memo Cards](https://www.memo.cards/blog/elaborative-interrogation)
- [Elaborative Interrogation - Duke Academic Resource Center](https://arc.duke.edu/elaborative-interrogation/)
- [Why Asking "Why?" Helps Students Learn - NOW Test Prep](https://www.nowtestprep.com/articles/why-asking-why-helps-students-learn-the-power-of-elaborative-interrogation)

### Dual Coding Theory
- [Dual Coding Theory and Education - Clark & Paivio (PDF)](https://nschwartz.yourweb.csuchico.edu/Clark%20&%20Paivio.pdf)
- [Dual-Coding Theory - Wikipedia](https://en.wikipedia.org/wiki/Dual-coding_theory)
- [Dual Coding Theory - InstructionalDesign.org](https://www.instructionaldesign.org/theories/dual-coding/)
- [Dual Coding: A Teacher's Guide to Visual Learning](https://www.structural-learning.com/post/dual-coding-a-teachers-guide)

### Chunking
- [Chunking (Psychology) - Wikipedia](https://en.wikipedia.org/wiki/Chunking_(psychology))
- [Information Processing Theory - G. Miller](https://www.instructionaldesign.org/theories/information-processing/)
- [What Is Chunking, and How Can It Improve Memory? - Coursera](https://www.coursera.org/articles/chunking)

### Feynman Technique
- [The Feynman Technique - Farnam Street](https://fs.blog/feynman-technique/)
- [The Feynman Technique - Dennis Learning Center, OSU](https://dennislearningcenter.osu.edu/the-feynman-technique/)
- [The Feynman Technique - Ali Abdaal](https://aliabdaal.com/studying/the-feynman-technique/)

### Schema Theory
- [Schema Theory - EBSCO Research Starters](https://www.ebsco.com/research-starters/psychology/schema-theory)
- [Schema Building: Beyond Piaget - Structural Learning](https://www.structural-learning.com/post/schema-building)
- [A Complete Guide to Schema Theory in Education](https://www.educationcorner.com/schema-theory/)

### Bloom's Taxonomy
- [Bloom's Revised Taxonomy - Colorado College](https://www.coloradocollege.edu/other/assessment/how-to-assess-learning/learning-outcomes/blooms-revised-taxonomy.html)
- [Bloom's Taxonomy - Simply Psychology](https://www.simplypsychology.org/blooms-taxonomy.html)
- [Taxonomies of Learning - Harvard Derek Bok Center](https://bokcenter.harvard.edu/taxonomies-learning)

### Interleaving
- [Interleaving: Why Mixing Topics Produces Stronger Learning](https://www.structural-learning.com/post/interleaving-a-teachers-guide)
- [Interleaved Practice Enhances Memory (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8589969/)
- [Interleaving: Boost Learning By Mixing Study](https://blog.alexanderfyoung.com/interleaving/)

### Generation Effect
- [Generation Effect - Wikipedia](https://en.wikipedia.org/wiki/Generation_effect)
- [The Generation Effect: Activating Broad Neural Circuits (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3556209/)
- [The Generation Effect: A Meta-Analytic Review (Springer)](https://link.springer.com/article/10.3758/BF03193441)
- [The Generation Effect - Ness Labs](https://nesslabs.com/generation-effect-3)

### Desirable Difficulties
- [Creating Desirable Difficulties to Enhance Learning - Bjork Lab (PDF)](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf)
- [Bjork's Desirable Difficulties - Durrington Research School](https://researchschool.org.uk/durrington/news/bjorks-desirable-difficulties)

### Dunlosky Meta-Analysis
- [Improving Students' Learning With Effective Learning Techniques - Dunlosky et al. (2013)](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266)
- [Strengthening the Student Toolbox - AFT](https://www.aft.org/ae/fall2013/dunlosky)

### Anki Best Practices and Wozniak's 20 Rules
- [Rules for Designing Precise Anki Cards](https://controlaltbackspace.org/precise/)
- [How to Make Better Anki Cards - Lean Anki](https://leananki.com/creating-better-flashcards/)
- [Anki Flashcard Best Practices - Med School Insiders](https://medschoolinsiders.com/medical-student/anki-flashcard-best-practices-how-to-create-good-cards/)
- [Effective Learning: Twenty Rules of Formulating Knowledge - SuperMemo](https://www.supermemo.com/en/blog/twenty-rules-of-formulating-knowledge)

### Cornell Note-Taking
- [The Cornell Note-Taking System - Cornell Learning Strategies Center](https://lsc.cornell.edu/how-to-study/taking-notes/cornell-note-taking-system/)
- [Cornell Notes - Wikipedia](https://en.wikipedia.org/wiki/Cornell_Notes)

### Understanding vs. Memorization
- [Memorization vs. Understanding - SchoolHabits](https://schoolhabits.com/memorization-vs-understanding-the-ultimate-study-secret/)
- [Why Writing by Hand Is Better for Memory - Scientific American](https://www.scientificamerican.com/article/why-writing-by-hand-is-better-for-memory-and-learning/)
- [Beyond Memorization: Strategies for Long-Term Retention - Faculty Focus](https://www.facultyfocus.com/articles/effective-teaching-strategies/beyond-memorization-strategies-for-long-term-retention/)
- [Teaching the Science of Learning (Springer)](https://link.springer.com/article/10.1186/s41235-017-0087-y)
