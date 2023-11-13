// ==UserScript==
// @name         CoolAdminTools Search for sections
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Search for matching section names in filtered course list.
// @author       You
// @match        https://*.instructure.com/accounts/*/admin_tools
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let g = {}

    async function getResults(courselist,section){
        console.log (section)
        let div = document.getElementById('seksjon_result')
        let html = ''
        let regexp = new RegExp(section,'i')
        let counter = 1
        for (const course of courselist){
            div.innerHTML = `Sjekker kurs ${counter++} av ${courselist.length}.`
            let found = false
            let sectionlist = await g.canvas.get(`courses/${course.id}/sections`)
            for (const section of sectionlist){
                if (regexp.test(section.name) || regexp.test(section.sis_section_id)){
                    if (!found){
                        html += `<b><a href="${location.origin}/courses/${course.id}" target="_blank">${course.name}</a></b><ul>`
                        found = true
                    }
                    html += `<li>${section.name}</li>`
                }
            }
            if (found) html += '</ul>'
        }
        div.innerHTML = html
    }

    function callback(courselist){
        let div = document.getElementById('seksjon_regexp')
        div.innerHTML = '<label for="inputseksjonregexp">Skriv inn regexp for seksjonsnavn:</label><input id="inputseksjonregexp" type="text" size="50"><button type="button" id="sectionsearchbutton">Søk</button>'
        let button = document.getElementById('sectionsearchbutton')
        button.onclick = ()=> getResults(courselist,document.getElementById('inputseksjonregexp').value)
    }

    function init(){
        g.cool = window.cooladmintools.coolAPI
        g.canvas = window.cooladmintools.canvasAPI
        let html = g.cool.addTool('Seksjonssøk')
        html.innerHTML = '<div id="seksjon_coursesearch"> </div><div id="seksjon_regexp"> </div><div id="seksjon_result"> </div>'
        g.cool.makeFilter(document.getElementById('seksjon_coursesearch'),callback)
    }

    function wait(){
        if (window.cooladmintools?.done) init()
        else setTimeout(wait, 500)
    }
    wait()
})();
