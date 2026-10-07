# Helper: generates common <head> block. Usage: source _head.sh && head_block "Title" "description"
head_block() {
  TITLE="$1"
  DESC="$2"
  echo "$TITLE||$DESC"
}
