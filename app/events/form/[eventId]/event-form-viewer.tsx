import {
  ExternalLink,
} from "lucide-react";


type EventFormViewerProps = {
  eventTitle: string;
  prefilledFormUrl: string;
  embedUrl: string;
};


export default function EventFormViewer({
  eventTitle,
  prefilledFormUrl,
  embedUrl,
}: EventFormViewerProps) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <a
          href={
            prefilledFormUrl
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-meta inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
        >
          <ExternalLink
            size={14}
            className="shrink-0"
          />

          別タブで開く
        </a>
      </div>


      <iframe
        src={
          embedUrl
        }
        title={`${eventTitle} 出席登録フォーム`}
        className="min-h-[75vh] w-full rounded-card border border-line bg-surface"
      />
    </>
  );
}