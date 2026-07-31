import { MEDIA_LABEL, type ScheduledPost, type SocialAccount } from "@/lib/types";
import { fmtTime, relativeLabel } from "@/lib/format";
import { MediaThumb } from "./MediaThumb";
import { StatusBadge } from "./StatusBadge";
import { Avatar } from "./Avatar";

export function PostListItem({
  post,
  accounts,
}: {
  post: ScheduledPost;
  accounts: SocialAccount[];
}) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const postAccounts = post.accountIds
    .map((id) => byId.get(id))
    .filter(Boolean) as SocialAccount[];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-fluid hover:border-brand-blue/30 hover:shadow-card">
      <MediaThumb media={post.media[0]} type={post.mediaType} className="h-14 w-14 rounded-xl" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex -space-x-1.5">
            {postAccounts.map((a) => (
              <Avatar key={a.id} account={a} size={18} />
            ))}
          </span>
          <span className="font-semibold text-ink">{relativeLabel(post.scheduledFor)}</span>
          <span>· {fmtTime(post.scheduledFor)}</span>
          <span className="hidden sm:inline">· {MEDIA_LABEL[post.mediaType]}</span>
          {post.createdBy && (
            <span className="hidden md:inline">· por {post.createdBy.split("@")[0]}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-slate-600">{post.caption}</p>
      </div>

      <StatusBadge status={post.status} />
    </div>
  );
}
