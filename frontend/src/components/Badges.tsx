import React from "react";
import { SealRow } from "./ui";

/** Soulbound streak badges as wax seals; unearned tiers are a blind emboss when `showLocked`. */
export function BadgeRow({ mask, showLocked = false, size = 24 }: { mask: number; showLocked?: boolean; size?: number }) {
  return <SealRow mask={mask} showLocked={showLocked} size={size} />;
}
