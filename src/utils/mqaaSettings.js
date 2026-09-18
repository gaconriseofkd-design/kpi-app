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

const SCORE_SETTINGS_KEY = "mqaa_patrol_score_settings";
export const DEFAULT_NORMAL_SCORES = [0, 2, 4];
export const DEFAULT_CRITICAL_SCORES = [-4, 0, 4];

/**
 * Get current score settings for normal and critical criteria.
 */
export function getPatrolScoreSettings() {
    try {
        const local = localStorage.getItem(SCORE_SETTINGS_KEY);
        if (local) {
            const parsed = JSON.parse(local);
            const normal = Array.isArray(parsed.normalScores) && parsed.normalScores.length > 0
                ? parsed.normalScores.map(Number).filter(n => !isNaN(n))
                : DEFAULT_NORMAL_SCORES;
            const critical = Array.isArray(parsed.criticalScores) && parsed.criticalScores.length > 0
                ? parsed.criticalScores.map(Number).filter(n => !isNaN(n))
                : DEFAULT_CRITICAL_SCORES;
            return {
                normalScores: normal.slice(0, 5),
                criticalScores: critical.slice(0, 5)
            };
        }
    } catch (e) {
        console.warn("Error reading score settings from localStorage:", e);
    }
    return {
        normalScores: DEFAULT_NORMAL_SCORES,
        criticalScores: DEFAULT_CRITICAL_SCORES
    };
}

/**
 * Save score settings to localStorage and Supabase
 */
export async function setPatrolScoreSettings({ normalScores, criticalScores }) {
    const validNormal = (Array.isArray(normalScores) && normalScores.length > 0
        ? normalScores.map(Number).filter(n => !isNaN(n))
        : DEFAULT_NORMAL_SCORES).slice(0, 5);

    const validCritical = (Array.isArray(criticalScores) && criticalScores.length > 0
        ? criticalScores.map(Number).filter(n => !isNaN(n))
        : DEFAULT_CRITICAL_SCORES).slice(0, 5);

    const payload = {
        normalScores: validNormal,
        criticalScores: validCritical
    };

    // 1. Save to localStorage
    try {
        localStorage.setItem(SCORE_SETTINGS_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("mqaa_score_settings_changed", { detail: payload }));
    } catch (e) {
        console.warn("Error saving score settings to localStorage:", e);
    }

    // 2. Persist to Supabase
    try {
        await Promise.all([
            supabase.from("mqaa_patrol_sections").upsert({
                id: "_CONFIG_NORMAL_SCORES_",
                name: JSON.stringify(validNormal),
                sort_order: 9998
            }),
            supabase.from("mqaa_patrol_sections").upsert({
                id: "_CONFIG_CRITICAL_SCORES_",
                name: JSON.stringify(validCritical),
                sort_order: 9997
            })
        ]);
    } catch (err) {
        console.warn("Error persisting score settings to Supabase:", err);
    }

    return payload;
}

/**
 * React hook to read and update score settings with live syncing
 */
export function usePatrolScoreSettings() {
    const [scoreSettings, setScoreSettingsState] = useState(getPatrolScoreSettings);

    useEffect(() => {
        // Fetch remote config from Supabase on mount
        const fetchRemote = async () => {
            try {
                const { data } = await supabase
                    .from("mqaa_patrol_sections")
                    .select("id, name")
                    .in("id", ["_CONFIG_NORMAL_SCORES_", "_CONFIG_CRITICAL_SCORES_"]);

                if (data && data.length > 0) {
                    let normal = null;
                    let critical = null;

                    data.forEach(row => {
                        try {
                            if (row.id === "_CONFIG_NORMAL_SCORES_" && row.name) {
                                const parsed = JSON.parse(row.name);
                                if (Array.isArray(parsed) && parsed.length > 0) normal = parsed.map(Number);
                            }
                            if (row.id === "_CONFIG_CRITICAL_SCORES_" && row.name) {
                                const parsed = JSON.parse(row.name);
                                if (Array.isArray(parsed) && parsed.length > 0) critical = parsed.map(Number);
                            }
                        } catch (e) {}
                    });

                    if (normal || critical) {
                        setScoreSettingsState(prev => {
                            const updated = {
                                normalScores: normal || prev.normalScores,
                                criticalScores: critical || prev.criticalScores
                            };
                            localStorage.setItem(SCORE_SETTINGS_KEY, JSON.stringify(updated));
                            return updated;
                        });
                    }
                }
            } catch (err) {
                // Ignore if not found
            }
        };
        fetchRemote();

        // Listen for local changes
        const handleLocalChange = (e) => {
            if (e.detail) {
                setScoreSettingsState(e.detail);
            }
        };

        window.addEventListener("mqaa_score_settings_changed", handleLocalChange);
        return () => window.removeEventListener("mqaa_score_settings_changed", handleLocalChange);
    }, []);

    const updateScoreSettings = async (newSettings) => {
        const saved = await setPatrolScoreSettings(newSettings);
        setScoreSettingsState(saved);
    };

    return {
        normalScores: scoreSettings.normalScores,
        criticalScores: scoreSettings.criticalScores,
        setScoreSettings: updateScoreSettings
    };
}
