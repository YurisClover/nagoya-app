import {auth,} from "@/auth";

import {redirect,} from "next/navigation";

import EventsClient from "./eventsClient";

export default async function EventsPage() {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <EventsClient
      role={
        session.user.role
      }
  />
    )
  }

//   return (
//     <div className="page-container">
//       <h1 className="mb-6 text-lg font-bold">イベント案内一覧</h1>

//       {error ? (
//         <div className="card text-center">
//           <p className="text-sm text-danger">イベント情報を取得できませんでした。</p>
//           <p className="text-meta mt-1">時間をおいて再度お試しください。</p>
//         </div>
//       ) : isLoading ? (
//         <p className="text-meta py-6 text-center">読み込み中...</p>
//       ) : !events?.length ? (
//         <p className="text-meta py-6 text-center">予定されているイベントはありません。</p>
//       ) : (
//         <div className="space-y-3">
//           {events.map((event) => (
//             <EventCard key={event.id} event={event} />
//           ))}
//         </div>
//       )}
//     </div>
//   );