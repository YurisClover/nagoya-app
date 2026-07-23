export type EventWithStatus = {
    id: number;
    title: string;
    event_date: string;
    form_url: string;
    is_answered: boolean | null;
}