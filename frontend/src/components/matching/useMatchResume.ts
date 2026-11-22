"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { listResumes, type Resume } from "@/lib/api";

function getStorageKey(userId?: string) {
  return userId ? `skillio_match_resume_${userId}` : null;
}

export function useMatchResume() {
  const { user } = useAuth();
  const [parsedResumes, setParsedResumes] = useState<Resume[]>([]);
  const [totalActiveCVs, setTotalActiveCVs] = useState<number>(0);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadResumes = useCallback(async () => {
    await Promise.resolve();
    if (!user || user.role !== "candidate") {
      setParsedResumes([]);
      setSelectedResumeId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const allActive = await listResumes("active");
      setTotalActiveCVs(allActive.length);
      const parsed = allActive.filter((r) => r.parse_status === "ok");
      setParsedResumes(parsed);

      if (parsed.length === 0) {
        setSelectedResumeId(null);
      } else if (parsed.length === 1) {
        setSelectedResumeId(parsed[0].id);
      } else {
        let preferredId: string | null = null;
        const key = getStorageKey(user.id);
        if (key) {
          try {
            preferredId = localStorage.getItem(key);
          } catch {
            // LocalStorage inaccessible
          }
        }
        const found = parsed.find((r) => r.id === preferredId);
        setSelectedResumeId(found ? found.id : parsed[0].id);
      }
    } catch {
      setError("Unable to load resumes");
      setParsedResumes([]);
      setSelectedResumeId(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadResumes();
  }, [loadResumes]);

  const selectResume = useCallback(
    (id: string) => {
      setSelectedResumeId(id);
      const key = getStorageKey(user?.id);
      if (key) {
        try {
          localStorage.setItem(key, id);
        } catch {
          // LocalStorage inaccessible
        }
      }
    },
    [user?.id]
  );

  const selectedResume =
    parsedResumes.find((r) => r.id === selectedResumeId) ?? null;

  return {
    parsedResumes,
    totalActiveCVs,
    selectedResumeId,
    selectedResume,
    selectResume,
    loading,
    error,
    hasParsedCV: parsedResumes.length > 0,
    reload: loadResumes,
  };
}
