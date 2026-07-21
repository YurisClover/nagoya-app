import Metrics from "./metrics";
import Activity from "./activity";
import QuickAction from "./quickAction";
import EventAttendance from "./eventAttendance";

export default function AdminHomePage(){
    return(
       <main>
       <div>ダッシュボード</div>
       <Metrics/>
       <div className="flex gap-6 w-full">
        <Activity />
        <QuickAction />
      </div>
       <EventAttendance/>
       </main>
    );
}