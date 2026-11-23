import { Category } from "./types";

/**
 * Community challenges. Joining one creates a normal on-chain pact with the template's exact
 * title, so participation stats are computed directly from contract data.
 */
export interface ChallengeTemplate {
  id: string;
  title: string;
  category: Category;
  totalDays: number;
  dailyStake: string; // QIE
  description: string;
  proofHint: string;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "builder-sprint",
    title: "QIE Builder Sprint: ship code daily",
    category: Category.CODING,
    totalDays: 14,
    dailyStake: "5",
    description: "Ship code every day for two weeks. A commit, a PR, a deploy — anything real.",
    proofHint: "Photo of your screen showing today's work, with the code written on a note.",
  },
  {
    id: "dawn-runners",
    title: "Dawn Runners: 5K or workout daily",
    category: Category.FITNESS,
    totalDays: 7,
    dailyStake: "10",
    description: "Run 5K or finish a full workout every day for a week.",
    proofHint: "Photo at the gym, track, or of your treadmill console with the code.",
  },
  {
    id: "study-streak",
    title: "Study Streak: 30 minutes a day",
    category: Category.LEARNING,
    totalDays: 30,
    dailyStake: "2",
    description: "Thirty minutes of focused study or language practice for a month.",
    proofHint: "Photo of your notes, book, or lesson with the code written on the page.",
  },
  {
    id: "calm-mind",
    title: "Calm Mind: 10-minute meditation",
    category: Category.MEDITATION,
    totalDays: 21,
    dailyStake: "1",
    description: "Meditate for ten minutes every day for three weeks.",
    proofHint: "Photo of your meditation space or timer with the code beside it.",
  },
];
