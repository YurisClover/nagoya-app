'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export const useEvents = () => {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const userName = session?.user?.name || 'ゲスト';
        const url = `http://localhost:5001/?user_name=${encodeURIComponent(userName)}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("サーバーエラー");
        setEvents(await res.json());
      } catch (error) {
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [session, status]);

  return { events, isLoading, isError };
};