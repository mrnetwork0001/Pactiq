export enum Category {
  FITNESS = "FITNESS",
  CODING = "CODING",
  LEARNING = "LEARNING",
  MEDITATION = "MEDITATION",
  CUSTOM = "CUSTOM"
}

export enum PactStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export interface Pact {
  id: number;
  creator: string;
  title: string;
  category: Category;
  dailyStake: string; // in QIE (e.g. "5.0")
  totalDays: number;
  checkInCount: number;
  currentDay: number;
  totalStaked: string; // in QIE
  status: PactStatus;
  qieId: string;
  startTime: number;
  lastCheckInTime?: number;
  hasCheckedInToday: boolean;
  history: {
    day: number;
    checkedIn: boolean;
    proofHash?: string;
    verifiedAt?: number;
  }[];
}

export interface LeaderboardUser {
  rank: number;
  address: string;
  qieId: string;
  currentStreak: number;
  totalCompleted: number;
  totalRewardsEarned: string; // in QIE
  hasQiePass: boolean;
}

export interface VerifyProofResponse {
  verified: boolean;
  confidence: number;
  category: Category;
  detectedFeatures: string[];
  proofHash: `0x${string}`;
  signature: `0x${string}`;
  dayIndex: number;
  reasoning: string;
  error?: string;
}
