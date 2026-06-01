'use client'

import { useEffect, useState } from "react";
import { fetchConversations } from "@/lib/services/client/chat.service";

export function useUnreadCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        const conversations = await fetchConversations();
        const totalUnread = conversations.reduce(
          (sum: number, conversation: { unreadCount: number }) => sum + conversation.unreadCount,
          0,
        );
        setUnreadCount(totalUnread);
      } catch (error) {
        console.error("[useUnreadCount]", error);
        setUnreadCount(0);
      }
    };

    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    const handleRefresh = () => {
      void loadUnreadCount();
    };
    window.addEventListener("refreshNotifications", handleRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("refreshNotifications", handleRefresh);
    };
  }, [enabled]);

  return unreadCount;
}
