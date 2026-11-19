# The README's CLI demo. Regenerate with VHS (https://github.com/charmbracelet/vhs)
# from the repository root, with `seomator` on PATH (`npm i -g @seomator/seo-audit`):
#
#   vhs docs/assets/cli-demo.tape
#
# The audit runs for real against books.toscrape.com, a public sandbox built for
# crawlers; the minute it spends checking links is cut from the recording.

Output docs/assets/cli-demo.gif

Set Shell "bash"
Set FontSize 15
Set Width 1100
Set Height 720
Set Padding 24
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Framerate 20
Set TypingSpeed 45ms
Set WaitTimeout 240s

# A clean prompt and an empty history for the run
Hide
Type "export SEOMATOR_HOME=$(mktemp -d) PS1='$ ' && clear"
Enter
Show

Sleep 600ms
Type "seomator audit https://books.toscrape.com"
Sleep 700ms
Enter

# The live table fills in category by category
Sleep 8s

# Cut the rest of the run: resume when the prompt is back
Hide
Wait /\$$/
Show
Sleep 1500ms

# Back to the top of the run. Every scroll happens off camera, so the GIF
# jumps: a visible scroll redraws the whole screen on each frame and made the
# GIF several times larger.
Hide
ScrollUp@1ms 720
Show
Sleep 1800ms

# Then down through the report: score, category bars, first issues
Hide
ScrollDown@1ms 18
Show
Sleep 400ms
Hide
ScrollDown@1ms 18
Show
Sleep 3500ms
Hide
ScrollDown@1ms 25
Show
Sleep 400ms
Hide
ScrollDown@1ms 25
Show
Sleep 3500ms
