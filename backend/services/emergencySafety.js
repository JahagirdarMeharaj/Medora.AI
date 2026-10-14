const EMERGENCY_REPLY =
  'Some symptoms you mentioned may need emergency care. If any are happening now, started suddenly, or are getting worse, call your local emergency number or go to the nearest emergency department now. Do not wait for a chatbot response. If possible, ask someone nearby to stay with you. This is an initial safeguard, not a clinically validated triage system; it cannot determine whether you are safe.';

const EMERGENCY_SIGNS = [
  {
    category: 'breathing difficulty',
    pattern: /\b(?:can't|cannot|can not|unable to|struggling to|having (?:a )?difficulty|difficulty|trouble|hard to)\s+(?:breathe|breathing|catch(?:ing)?\s+(?:my|their|his|her|your)?\s*breath|get enough air)\b|\b(?:can|could)\s+(?:only\s+)?speak\s+(?:a\s+)?few words\b|\b(?:gasping for air|shortness of breath|short of breath|not breathing|turning blue|lips? (?:are )?blue)\b/i
  },
  {
    category: 'chest pain or pressure',
    pattern: /\b(?:(?:severe|crushing|intense|heavy|tight|painful)\s+(?:chest\s+)?(?:pain|pressure|tightness)|chest\s+(?:pain|pressure|tightness)|pressure\s+(?:in|on)\s+(?:(?:my|the|his|her|their)\s+)?chest|(?:chest|heart)\s+(?:feels|is)\s+(?:heavy|tight|crushed|crushing)|like an? elephant (?:is )?sitting on (?:my|the) chest)\b/i
  },
  {
    category: 'sudden confusion or unresponsiveness',
    pattern: /\b(?:sudden(?:ly)?|new|acute)\s+(?:(?:became|becomes|becoming|got|is|was)\s+)?(?:onset of\s+)?(?:confusion|confused|disorientation|disoriented)\b|\b(?:unresponsive|unconscious|can't wake(?: them)?|cannot wake|won't wake|hard to wake|difficult to wake|impossible to wake)\b/i
  },
  {
    category: 'seizure',
    pattern: /\b(?:seizure|seizing|convulsion|convulsing)\b/i
  },
  {
    category: 'possible stroke signs',
    pattern: /\b(?:face droop(?:ing)?|drooping face|(?:face|mouth) is drooping|one[- ]sided (?:weakness|numbness)|weakness on (?:one|the) side|numbness on (?:one|the) side|(?:one|the) side of (?:my|his|her|their) body (?:suddenly )?(?:feels )?(?:weak|numb)|slurred speech|sudden trouble speaking|sudden (?:weakness|numbness) on (?:one|the) side)\b/i
  },
  {
    category: 'severe allergic reaction',
    pattern: /\b(?:throat|tongue|lips?)\s+(?:is\s+|are\s+)?(?:swelling|swollen|closing(?: up)?)\b|\b(?:throat closing|anaphylaxis|severe allergic reaction)\b/i
  },
  {
    category: 'severe bleeding or choking',
    pattern: /\b(?:bleeding (?:won't|will not|can't|cannot) stop|uncontrolled bleeding|bleeding heavily|severe bleeding|choking)\b/i
  },
  {
    category: 'possible poisoning or overdose',
    pattern: /\b(?:overdose|poisoned|poisoning|took too many (?:pills|tablets|medications|medicines)|swallowed (?:a )?(?:toxic|poisonous) substance)\b/i
  }
];

const NEGATION_AT_END =
  /(?:\bno\b(?!\s+longer)|\bnot\b|\bnever\b|\bwithout\b|\bden(?:y|ies|ied)\b|\bdon't\b|\bdo not\b|\bdoesn't\b|\bdoes not\b|\bhaven't\b|\bhave not\b|\bhasn't\b|\bhas not\b|\bisn't\b|\bis not\b|\baren't\b|\bare not\b|\bwasn't\b|\bwas not\b|\bweren't\b|\bwere not\b)\s+(?:(?:any|currently|experiencing|having|have|had|feel|feeling|think|a|the|my|his|her|their|this|that|much|severe|signs of|symptoms of)\s+){0,6}$/i;

const MAX_HISTORY_MESSAGES = 5;
const MAX_MESSAGE_LENGTH = 2000;

function hasNegationBefore(text, index) {
  const prefix = text.slice(Math.max(0, index - 100), index);
  const boundaries = [...prefix.matchAll(/[.!?;\n]+|\b(?:but|however|although|yet)\b/gi)];
  const lastBoundary = boundaries.at(-1);
  const clause = lastBoundary
    ? prefix.slice(lastBoundary.index + lastBoundary[0].length)
    : prefix;

  return NEGATION_AT_END.test(clause);
}

function hasEmergencySign(text) {
  for (const sign of EMERGENCY_SIGNS) {
    const matches = text.matchAll(new RegExp(sign.pattern.source, 'gi'));
    for (const match of matches) {
      if (!hasNegationBefore(text, match.index)) {
        return sign.category;
      }
    }
  }

  return null;
}

function assessEmergency(message, recentUserMessages = []) {
  if (typeof message !== 'string' || !message.trim()) {
    return { status: 'unable-to-assess' };
  }

  const history = Array.isArray(recentUserMessages)
    ? recentUserMessages
      .filter(item => typeof item === 'string' && item.trim())
      .slice(-MAX_HISTORY_MESSAGES)
      .map(item => item.slice(0, MAX_MESSAGE_LENGTH))
    : [];
  const messagesToCheck = [...history, message];

  for (const text of messagesToCheck) {
    const category = hasEmergencySign(text);
    if (category) {
      return { status: 'possible-emergency', category, reply: EMERGENCY_REPLY };
    }
  }

  return { status: 'no-match' };
}

module.exports = { assessEmergency };
