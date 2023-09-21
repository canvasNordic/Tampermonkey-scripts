// ==UserScript==
// @name         CoolAdminTools Search v2
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Search for content in courses
// @author       You
// @match        https://*.instructure.com/accounts/*/admin_tools
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let g = {}

    async function coursesearch(){
        let searchregexp = document.getElementById("CS_searchfield").value.trim()
        searchregexp = searchregexp==""?/./:new RegExp(searchregexp,"i")
        let searchresult = document.getElementById("CS_searchreport")
        let max = g.courselist.length
        let current = 1
        let matchedCourses = 0
        let html = ""
        let div = document.createElement('div')
        let published = document.getElementById('CS_onlypublished').checked?'published=true&':''
        let searcharea = document.getElementById('CS_searcharea').value
        console.log (searcharea)
        for (const course of g.courselist){
            let foundInThisCourse = false;
            searchresult.innerHTML = `<p>Søker i kurs ${current} av ${max}. Regexp matchet i ${matchedCourses} kurs så langt.</p>`
            let pages = await g.canvas.getAll(`courses/${course.id}/pages?${published}per_page=100`)
            if (searcharea=='overskrift'){
                for (const page of pages){
                    if (searchregexp.test(page.title)){
                        //Treff funnet
                        if (!foundInThisCourse){
                            html += `<p><b>${course.name}</b></p>`
                            matchedCourses++
                            foundInThisCourse = true
                        }
                        html+=`<p><a href="${page.html_url}" target="_blank">${page.title}</a></p>`
                    }
                }
            }else{
                for (const page of pages){
                    let currentpage = await g.canvas.get(`courses/${course.id}/pages/${page.page_id}`)
                    let textToSearch = currentpage.body
                    if (searcharea=='text'){
                        div.innerHTML = currentpage.body
                        textToSearch = div.innerText
                    }
                    if (searchregexp.test(textToSearch)){
                        //Treff funnet
                        if (!foundInThisCourse){
                            html += `<p><b>${course.name}</b></p>`
                            matchedCourses++
                            foundInThisCourse = true
                        }
                        html+=`<p><a href="${page.html_url}" target="_blank">${page.title}</a></p>`
                    }
                }
            }
            current++
        }
        searchresult.innerHTML = html
    }


    function callback(courselist){
        g.courselist = courselist.filter(course=>course.state != 'deleted') //Can't search a deleted course.
        g.cool.addCSS(`
           #CS_searchfield {margin-left: 5px; margin-right: 1em;}
           #CS_onlypublished {margin-left: 5px; margin-right: 1em; marginTop: -=5px;}
           #CS_searcharea {margin-left: 5px; margin-right: 1em; width: 8em;}
        `)

        let mygui = document.getElementById('CS_GUI')
        mygui.innerHTML = '<label for="CS_searchfield">RegExp:</label><input id="CS_searchfield" type="text" size="50"> <label for="CS_onlypublished">Søk bare i publiserte sider: </label><input id="CS_onlypublished" type="checkbox"> <label for="CS_searcharea">Søk i: </label><select id="CS_searcharea"><option value="overskrift">Overskrift</option><option value="tekst">Tekst</option><option value="html">HTML</option></select><button type="button" id="CS_searchbutton">Søk</button>'
        document.getElementById('CS_searchbutton').onclick = e=>coursesearch()

    }

    function init(){
        g.cool = window.cooladmintools.coolAPI
        g.canvas = window.cooladmintools.canvasAPI
        let html = g.cool.addTool('Søk')
        html.innerHTML = '<div id="CS_coursesearch"> </div><div id="CS_GUI"> </div><div id="CS_searchreport"> </div>'
        g.cool.makeFilter(document.getElementById('CS_coursesearch'),callback)
    }

    function wait(){
        if (window.cooladmintools?.done) init()
        else setTimeout(wait, 500)
    }
    wait()
})();
