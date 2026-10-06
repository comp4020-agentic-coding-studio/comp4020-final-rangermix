//! /readme/ serves README.md rendered to HTML when the server starts, so its
//! headings are in the HTML the server sends, which the shipped check reads.
use pulldown_cmark::{Options, Parser, html};

pub fn render_page(markdown: &str) -> String {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_SMART_PUNCTUATION;
    let mut body = String::new();
    html::push_html(&mut body, Parser::new_ext(markdown, options));
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>About the cat café</title>
<style>{STYLE}</style>
</head>
<body>
<nav><a href="/">← Back to the café</a></nav>
<main>
{body}</main>
</body>
</html>
"#
    )
}

const STYLE: &str = "\
:root { color-scheme: light dark; --ink: #2b2230; --paper: #fbf6ee; --accent: #b4572d; }
@media (prefers-color-scheme: dark) { :root { --ink: #efe6dc; --paper: #1f1a22; --accent: #e8955c; } }
body { margin: 0; background: var(--paper); color: var(--ink); font: 17px/1.6 Georgia, 'Iowan Old Style', serif; }
nav, main { max-width: 42rem; margin: 0 auto; padding: 1rem; }
a { color: var(--accent); }
img { max-width: 100%; }
pre { overflow-x: auto; }";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headings_become_html_headings() {
        let page = render_page("# The cat café\n\n## Why\n\nBecause cats.");
        assert!(page.contains("<h1>The cat café</h1>"));
        assert!(page.contains("<h2>Why</h2>"));
        assert!(page.contains("<p>Because cats.</p>"));
    }

    #[test]
    fn the_page_links_back_to_the_cafe() {
        assert!(render_page("# x").contains("href=\"/\""));
    }
}
