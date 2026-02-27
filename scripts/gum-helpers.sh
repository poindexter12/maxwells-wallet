#!/usr/bin/env bash
# Shared gum helper functions for justfile recipes
# Source this file in shebang recipes: source scripts/gum-helpers.sh

# Returns 0 if stdout is a terminal (interactive mode)
is_tty() {
  [ -t 1 ]
}

# Run a command with a gum spinner, or plain output in non-TTY
# Usage: spin "Installing deps..." npm install
spin() {
  local title="$1"
  shift
  if is_tty; then
    gum spin --spinner dot --title "$title" -- "$@"
  else
    echo "$title"
    "$@"
  fi
}

# Prompt for confirmation with gum, or use default in non-TTY
# Usage: confirm "Delete everything?" false
confirm() {
  local message="$1"
  local default="${2:-true}"
  if is_tty; then
    if [ "$default" = "true" ]; then
      gum confirm "$message" --default=yes
    else
      gum confirm "$message" --default=no
    fi
  else
    if [ "$default" = "true" ]; then
      return 0
    else
      return 1
    fi
  fi
}

# Style text with a foreground color, or plain echo in non-TTY
# Usage: style 2 "Success message"
style() {
  local color="$1"
  shift
  if is_tty; then
    gum style --foreground "$color" "$*"
  else
    echo "$*"
  fi
}

# Display a header with a double border, or plain echo in non-TTY
# Usage: header "Maxwell's Wallet Setup"
header() {
  local text="$1"
  if is_tty; then
    gum style --border double --border-foreground 212 --padding "0 2" "$text"
  else
    echo "$text"
  fi
}
