# Product context

cslol-go is a desktop mod loader. Its Skin Fixer repairs an imported champion skin and exports it again. This site is that fixer as a page.

Flow: home, then "Skinini düzelt" / "Fix a skin". The user drops a file, sees champion, skin numbers, bins, and size, picks the pass options, fixes, and downloads.

The About block sits below the home fold. It opens as you scroll down and closes as you scroll back up. It names the author and shows a wide Discord profile, not a button.

What the user expects to match the desktop export:

- same skin name in LTK Manager
- same author, version, description, cover
- a `.modpkg`, not a zip
- a file size close to the desktop result

What this page cannot do: read a raw Riot `.wad` binary, pull missing assets from the game install, or download patch manifests. Those need `cslol-tools` and the League folder.
