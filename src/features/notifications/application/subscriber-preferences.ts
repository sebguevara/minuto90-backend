import type { DiffTriggerType } from "./diff-engine";

type SubscriberPreferences = {
  isActive: boolean;
  phoneNumber: string | null;
  notifyPreMatch30m: boolean;
  notifyKickoff: boolean;
  notifyGoals: boolean;
  notifyRedCards: boolean;
  notifyVarCancelled: boolean;
  notifyHalftime: boolean;
  notifySecondHalf: boolean;
  notifyFullTime: boolean;
};

export function canReceiveWhatsappNotifications(
  subscriber: Pick<SubscriberPreferences, "isActive" | "phoneNumber">
): subscriber is Pick<SubscriberPreferences, "isActive"> & { phoneNumber: string } {
  return subscriber.isActive && typeof subscriber.phoneNumber === "string" && subscriber.phoneNumber.length > 0;
}

export function isLiveTriggerEnabled(
  subscriber: SubscriberPreferences,
  triggerType: DiffTriggerType | "PRE_MATCH_30M"
) {
  switch (triggerType) {
    case "PRE_MATCH_30M":
      return subscriber.notifyPreMatch30m;
    case "KICKOFF":
      return subscriber.notifyKickoff;
    case "GOAL":
    case "PENALTY_SHOOTOUT_START":
    case "PENALTY_SHOOTOUT_KICK":
      return subscriber.notifyGoals;
    case "RED_CARD":
      return subscriber.notifyRedCards;
    case "VAR_CANCELLED":
      return subscriber.notifyVarCancelled;
    case "HALFTIME":
      return subscriber.notifyHalftime;
    case "SECOND_HALF":
      return subscriber.notifySecondHalf;
    case "FULL_TIME":
    case "FULL_TIME_DISAPPEARED":
      return subscriber.notifyFullTime;
    default:
      return false;
  }
}
