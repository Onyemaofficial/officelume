import type { KnowledgeArticle, KnowledgeCategory } from '../shared/types';
import type { KnowledgeContextItem } from './types';

/**
 * Lightweight, dependency-free retrieval over the approved knowledge base.
 * The knowledge base is small (tens of articles), so all active articles are scored in memory.
 * Scoring = IDF-weighted term overlap (title counts double) + a boost for the categories the
 * question is clearly about. Only active articles are ever considered.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could', 'do', 'does', 'did', 'for', 'from',
  'get', 'give', 'go', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or',
  'our', 'so', 'that', 'the', 'their', 'them', 'there', 'they', 'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'who', 'will', 'with', 'would', 'you', 'your', 'yours',
  // conversational filler
  'need', 'want', 'like', 'looking', 'look', 'help', 'please', 'tell', 'know', 'wondering', 'question', 'ask', 'asking',
  'any', 'some', 'much', 'many', 'also', 'just', 'about', 'really', 'thing', 'things', 'ok', 'okay', 'hi', 'hello',
  'hey', 'thanks', 'thank', 'yes', 'no', 'maybe', 'want', 'wanted', 'able', 'possible', 'let', 'make', 'sure', 'today',
  'offer', 'provide', 'available', 'take', 'come', 'send', 'someone', 'anyone', 'people', 'person', 'team', 'member',
  // domain-ubiquitous words that carry no discriminating signal
  'hvac', 'officelume', 'company', 'business', 'service', 'services', 'customer', 'customers', 'home', 'house',
  'check', 'checked', 'checking', 'inspect', 'inspected',
  // contraction fragments and negations
  'not', 'isn', 'doesn', 'don', 'won', 'aren', 'didn', 'wasn', 'couldn', 'cant', 'dont', 'wont',
]);

/** Phrases collapsed to a single canonical token so "air conditioner" and "AC" match each other. */
function canonicalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\ba\s*\/\s*c\b/g, ' ac ')
    .replace(/\bair[\s-]*con(ditioners?|ditioning|ditioned)?\b/g, ' ac ')
    .replace(/\bcooling\b/g, ' ac ')
    .replace(/\bfurnaces?\b/g, ' heat ')
    .replace(/\bheating\b/g, ' heat ')
    .replace(/\bheater\b/g, ' heat ')
    .replace(/\bheat\s*pumps?\b/g, ' heat pump ')
    .replace(/\bopening\b/g, ' open ')
    .replace(/\bclosing\b/g, ' close ')
    .replace(/[^a-z0-9\s]/g, ' ');
}

export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of canonicalize(text).split(/\s+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    const term = stem(raw);
    if (term.length >= 2 && !STOPWORDS.has(term)) seen.add(term);
  }
  return [...seen];
}

/** Which knowledge categories does the question clearly ask about? */
const CATEGORY_HINTS: Array<{ category: KnowledgeCategory; pattern: RegExp }> = [
  { category: 'hours', pattern: /\b(hours?|open|opens|opening|close|closes|closing|weekends?|saturday|sunday|monday|friday|what\s+time|when\s+are\s+you)\b/i },
  { category: 'pricing', pattern: /\b(cost|costs|price|prices|pricing|how\s+much|estimate|estimates|quote|quotes|fee|fees|charge|charges|afford|rate|rates|expensive|cheap)\b/i },
  { category: 'service_area', pattern: /\b(area|areas|zip|city|cities|town|location|locations|neighbou?rhood|county|serve|serving|travel|near|my\s+area|do\s+you\s+(come|go)\s+to)\b/i },
  { category: 'scheduling', pattern: /\b(appointment|appointments|schedule|scheduling|availability|available|book|booking|reserve|slot|slots|same[-\s]day|next\s+(day|week)|tomorrow|earliest)\b/i },
  { category: 'emergency', pattern: /\b(emergency|emergencies|urgent|urgently|asap|24\s*\/?\s*7|after[-\s]hours|middle\s+of\s+the\s+night|no\s+(heat|cooling|ac))\b/i },
  { category: 'services', pattern: /\b(services|what\s+do\s+you\s+(do|fix)|repair|repairs|install|installation|maintenance|tune[-\s]?up|thermostat|air\s+quality|filter|filters|duct|ducts|brand|brands|equipment)\b/i },
];

export function detectCategoryHints(message: string): KnowledgeCategory[] {
  return CATEGORY_HINTS.filter((h) => h.pattern.test(message)).map((h) => h.category);
}

export interface ScoredArticle {
  article: KnowledgeArticle;
  score: number;
}

export interface RetrievalResult {
  matches: ScoredArticle[];
  /** Question terms that appear nowhere in the approved knowledge base. */
  unmatchedTerms: string[];
  queryTerms: string[];
  categoryHints: KnowledgeCategory[];
}

export const MIN_RELEVANCE_SCORE = 1.0;
export const MAX_CONTEXT_ARTICLES = 4;

export function retrieveKnowledge(
  message: string,
  articles: KnowledgeArticle[],
  options: { maxResults?: number; minScore?: number } = {},
): RetrievalResult {
  const maxResults = options.maxResults ?? MAX_CONTEXT_ARTICLES;
  const minScore = options.minScore ?? MIN_RELEVANCE_SCORE;

  const active = articles.filter((a) => a.active);
  const queryTerms = tokenize(message);
  const categoryHints = detectCategoryHints(message);

  const docTerms = active.map((a) => ({
    article: a,
    title: new Set(tokenize(a.title)),
    body: new Set(tokenize(`${a.content}`)),
  }));

  const docFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    docFrequency.set(term, docTerms.filter((d) => d.title.has(term) || d.body.has(term)).length);
  }

  const total = Math.max(active.length, 1);
  const scored: ScoredArticle[] = docTerms.map((d) => {
    let score = 0;
    for (const term of queryTerms) {
      const df = docFrequency.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + total / df);
      if (d.title.has(term)) score += idf * 2;
      else if (d.body.has(term)) score += idf;
    }
    if (categoryHints.includes(d.article.category)) score += 1.5;
    return { article: d.article, score };
  });

  const matches = scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const unmatchedTerms = queryTerms.filter((t) => (docFrequency.get(t) ?? 0) === 0);
  return { matches, unmatchedTerms, queryTerms, categoryHints };
}

export function toContextItems(matches: ScoredArticle[]): KnowledgeContextItem[] {
  return matches.map(({ article }) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    content: article.content,
  }));
}
