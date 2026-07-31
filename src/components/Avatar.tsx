import type { SocialAccount } from "@/lib/types";
import { PlatformIcon } from "./PlatformIcon";

export function Avatar({
  account,
  size = 40,
}: {
  account: SocialAccount;
  size?: number;
}) {
  const initials = account.name.slice(0, 2).toUpperCase();
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={`flex h-full w-full items-center justify-center rounded-full font-display text-sm font-bold text-white ${account.avatar}`}
      >
        {initials}
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
        <PlatformIcon
          platform={account.platform}
          className={
            account.platform === "instagram"
              ? "h-3.5 w-3.5 text-brand-orange"
              : "h-3.5 w-3.5 text-brand-blue"
          }
        />
      </span>
    </span>
  );
}
