export type EventWithStatus = {
    id: number;
    event_id: string;
    title: string;
    event_date: string;
    form_url: string;
    location: string;
    event_end_date: string;
    status: string; // publish or draft
    position: string; // general, executive, admin
    is_answered: boolean | null;
}

/** admin */
export type EventSheetHealth = {
    event_id: string;
    title: string;
    sheet_name: string;
    sheet_found: boolean;
    member_id_column: string | null;
    response_count: number | null;
}