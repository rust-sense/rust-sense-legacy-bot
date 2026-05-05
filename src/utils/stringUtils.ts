import { loadJsonResourceSync } from './filesystemUtils.js';

const htmlReservedSymbols = loadJsonResourceSync<Record<string, string>>('staticFiles/htmlReservedSymbols.json');

export function parseArgs(str: string): string[] {
    return str.trim().split(/[ ]+/);
}

export function getArgs(str: string, n = 0): string[] {
    const args = parseArgs(str);
    if (isNaN(n)) n = 0;
    if (n < 1) return args;
    const newArgs: string[] = [];

    let remain = str;
    let counter = 1;
    for (const arg of args) {
        if (counter === n) {
            newArgs.push(remain);
            break;
        }
        remain = remain.slice(arg.length).trim();
        newArgs.push(arg);
        counter += 1;
    }

    return newArgs;
}

export function decodeHtml(str: string): string {
    for (const [key, value] of Object.entries(htmlReservedSymbols)) {
        str = str.replace(key, value);
    }

    return str;
}

export function removeInvisibleCharacters(str: string): string {
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

export function findClosestString(string: string, array: string[], threshold = 2): string | null {
    let minDistance = Infinity;
    let closestString: string | null = null;

    for (let i = 0; i < array.length; i++) {
        const currentString = array[i];
        const distance = levenshteinDistance(string, currentString);

        if (distance < minDistance) {
            minDistance = distance;
            closestString = currentString;
        }

        if (minDistance === 0) break;
    }

    return minDistance > threshold ? null : closestString;
}

/* Function to calculate Levenshtein distance between two strings */
function levenshteinDistance(s1: string, s2: string): number {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = [];

    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }

    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}
