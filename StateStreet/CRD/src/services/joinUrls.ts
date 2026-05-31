export function joinUrls(...parts: string[]): string {
    const [firstPart = '', ...remainingParts] = parts;
    const cleanParts = [
        firstPart.replace(/\/+$/g, ''),
        ...remainingParts.map((part) => part.replace(/^\/+|\/+$/g, '')),
    ]
        .filter(Boolean);

    return cleanParts.join('/').replace(/([^:]\/)\/+/g, '$1');
}
