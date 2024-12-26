# Hydration

- Use suppressHydrationWarning on elements where hydration mismatches are expected and harmless (e.g. testing attributes, timestamps)
- For dynamic content that differs between server and client, use useEffect to update the content after initial render
- Avoid using browser-only APIs in the initial render (window, document, etc)
