// src/utils/mqaaSettings.js
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const TARGET_STORAGE_KEY = "mqaa_patrol_target_score";
const DEFAULT_TARGET = 90;

/**
 * Get current target score (% threshold)
 * Defaults to 90 if not set.
 */
export function getPatrolTargetScore() {
    try {
        const local = localStorage.getItem(TARGET_STORAGE_KEY);
        if (local !== null && !isNaN(Number(local))) {
            return Number(local);
        }
    } catch (e) {
        console.warn("Error reading target from localStorage:", e);
    }
    return DEFAULT_TARGET;
}

/**
 * Save target score (% threshold) to localStorage and Supabase
 */
export async function setPatrolTargetScore(target) {
    const num = Math.min(100, Math.max(0, Number(target) || DEFAULT_TARGET));
    
    // 1. Save to localStorage
    try {
        localStorage.setItem(TARGET_STORAGE_KEY, num.toString());
        window.dispatchEvent(new CustomEvent("mqaa_target_changed", { detail: num }));
    } catch (e) {
        console.warn("Error saving target to localStorage:", e);
    }

    // 2. Persist to Supabase in mqaa_patrol_sections with special ID '_CONFIG_TARGET_'
    try {
        await supabase
            .from("mqaa_patrol_sections")
            .upsert({
                id: "_CONFIG_TARGET_",
                name: num.toString(),
                sort_order: 9999
            });
    } catch (err) {
        console.warn("Error persisting target to Supabase:", err);
    }

    return num;
}

/**
 * React hook to read and update target score with live syncing
 */
export function usePatrolTarget() {
    const [target, setTarget] = useState(getPatrolTargetScore);

    useEffect(() => {
        // Fetch remote config from Supabase on mount
        const fetchRemote = async () => {
            try {
                const { data } = await supabase
                    .from("mqaa_patrol_sections")
                    .select("name")
                    .eq("id", "_CONFIG_TARGET_")
                    .single();

                if (data && data.name && !isNaN(Number(data.name))) {
                    const remoteNum = Number(data.name);
                    setTarget(remoteNum);
                    localStorage.setItem(TARGET_STORAGE_KEY, remoteNum.toString());
                }
            } catch (err) {
                // Ignore if not found
            }
        };
        fetchRemote();

        // Listen for local changes
        const handleLocalChange = (e) => {
            if (e.detail !== undefined) {
                setTarget(e.detail);
            }
        };

        window.addEventListener("mqaa_target_changed", handleLocalChange);
        return () => window.removeEventListener("mqaa_target_changed", handleLocalChange);
    }, []);

    const updateTarget = async (newVal) => {
        const saved = await setPatrolTargetScore(newVal);
        setTarget(saved);
    };

    return { targetScore: target, setTargetScore: updateTarget };
}
