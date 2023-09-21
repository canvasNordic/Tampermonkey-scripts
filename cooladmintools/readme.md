# CoolAdminTools
## What and where?
As an admin you have access to a page named Admin Tools (Norwegian: Admin-verktøy) with a few tools included from Instructure. CoolAdminTools is used to extend the selection of tools.
CoolAdminTools consists of a central script that handles the tabs, simplify calling the Canvas API, let the user filter which courses to work on, and several other things. You insert the script in your favorite userscript-manager (Tampermonkey/Greasemonkey/Violentmonkey). There are a few things you can configure, and there is documentation to write your own tools.

In addition you insert one or more of the other scripts into your favorite userscript-manager (as separate scripts) to get the tools you want. These scripts utilize the central script and waits for the central script to load the courselist for the current account.
