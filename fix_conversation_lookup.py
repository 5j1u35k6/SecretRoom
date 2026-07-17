from pathlib import Path

path = Path('app.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    'const list = box.querySelector(`[id="comments-list-${CSS.escape(postId)}"]`);',
    'const list = document.getElementById(`comments-list-${postId}`);'
)
text = text.replace(
    'let input = composer.querySelector(`[id="comment-input-${CSS.escape(postId)}"]`);',
    'let input = document.getElementById(`comment-input-${postId}`);'
)
path.write_text(text, encoding='utf-8')
