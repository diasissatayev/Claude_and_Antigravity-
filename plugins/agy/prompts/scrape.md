Web scraping task.

Target URL: {{URL}}
What to extract: {{SCHEMA}}
Output format: {{FORMAT}}

1. Fetch the URL (read_url for static HTML, the browser for JS-heavy pages).
2. Extract the requested fields. A missing field is null/empty — never fabricate.
3. Paginated page: scrape the first page only unless told otherwise, and note the pagination.
4. Markdown format: a short preamble (URL, time, fields) then a Markdown table. JSON format: one valid JSON document.

Write the result with write_file to {{OUT}}.
Then reply with ONLY: the number of records and fields extracted, and anything that blocked you (login wall, captcha, pagination).
