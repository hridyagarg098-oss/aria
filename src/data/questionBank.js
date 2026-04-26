import { PHYSICS_QUESTIONS } from './physicsQuestions';
import { CHEMISTRY_QUESTIONS } from './chemistryQuestions';
import { MATHS_QUESTIONS } from './mathsQuestions';
import { ENGLISH_QUESTIONS, REASONING_QUESTIONS } from './verbalReasoningQuestions';

export const FULL_QUESTION_POOL = [
  ...PHYSICS_QUESTIONS,
  ...CHEMISTRY_QUESTIONS,
  ...MATHS_QUESTIONS,
  ...ENGLISH_QUESTIONS,
  ...REASONING_QUESTIONS,
];

export {
  PHYSICS_QUESTIONS,
  CHEMISTRY_QUESTIONS,
  MATHS_QUESTIONS,
  ENGLISH_QUESTIONS,
  REASONING_QUESTIONS,
};
