//  import { EventCreateTestButton } from "./EventCreateTestButton";
 
//  export default  function EventsPage(){
//      return (
//       <main>
//        <EventCreateTestButton/>
//       </main>
//      );
//  }
import {
  EventCreateForm,
} from "./eventCreateForm";

export default function EventsPage() {
  return (
    <main>
      <h1>イベント管理</h1>

      <EventCreateForm />
    </main>
  );
}


