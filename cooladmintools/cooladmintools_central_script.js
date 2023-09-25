// ==UserScript==
// @name         CoolAdminTools central script
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  The one to rule them all
// @author       Tore B. Jørgensen
// @match        https://*.instructure.com/accounts/*/admin_tools
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

/*TODO:
- Legge inn flere Canvas-api-funksjoner
- Legge inn funksjon for eksport av csv og png
*/

(function() {
    'use strict';

    /*******************/
    /* Config settings */
    /*******************/
    const alwaysREST = false //Always use REST API to collect courselist
    const RESTon = [1] //Use REST API to collect courselist on these accounts
    const termSortAlg = 'uio' //uio,date

    /*********************/
    /* Utility functions */
    /*********************/
    function createRandomPrefix(length){
        const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        let result = '';
        for (let i=0; i<length; i++){
            result += characters.charAt(Math.floor(Math.random()*characters.length))
        }
        return result
    }

    /******************************************************************************************************************/
    /* Function to create the cooladmintools object and its internal variables and functions and the addTool function */
    /* This is where the tool tab stuff is.
    /******************************************************************************************************************/
    function createCoolAdminToolsObject(){
        window.cooladmintools = {done:false,
                                 canvasAPI:{},
                                 coolAPI:{},
                                 internal:{
                                     nativeTools:[],
                                     lastNativeTool:'',
                                     lastNativePane:undefined,
                                     activeTool:document.querySelector('#adminToolsTabNav li.ui-tabs-active a').getAttribute('id'),
                                 }
                                }

        window.cooladmintools.internal.tabclick = function(e){
            //The user clicked on the tab of a tool.
            window.cooladmintools.internal.hideOld(window.cooladmintools.internal.activeTool)

            if (!window.cooladmintools.internal.nativeTools.includes(e.srcElement.id)){
                window.cooladmintools.internal.showNew (e.srcElement.id); //native Canvas tools does this themself
            }else if (e.srcElement.id == window.cooladmintools.internal.lastNativeTool){//except if we go back to the last active tool, then we must help a little
                let nativepane = window.cooladmintools.internal.lastNativePane
                nativepane.setAttribute('aria-expanded','true')
                nativepane.setAttribute('aria-hidden','false')
                nativepane.style.display = 'block'
            }
            window.cooladmintools.internal.activeTool = e.srcElement.id
        }

        window.cooladmintools.internal.hideOld = function(oldActive){
            //Hide pane of the tool we're moving away from
            let pane = document.querySelector(`#adminToolsTabPanes div[aria-labelledby='${oldActive}']`)
            if (window.cooladmintools.internal.nativeTools.includes(oldActive)){
                console.log ("remember old")
                window.cooladmintools.internal.lastNativeTool = oldActive
                window.cooladmintools.internal.lastNativePane = pane
            }
            pane.setAttribute('aria-expanded','false')
            pane.setAttribute('aria-hidden','true')
            pane.style.display = 'none'
            let tab = document.querySelector(`#adminToolsTabNav li[aria-labelledby='${oldActive}']`)
            tab.setAttribute('tabindex','-1')
            tab.setAttribute('aria-selected','false')
            tab.classList.remove('ui-tabs-active', 'ui-state-active')
        }

        window.cooladmintools.internal.showNew = function(newActive){
            console.log ("showNew: "+newActive)
            //Show pane of the tool we've selected
            let pane = document.querySelector(`#adminToolsTabPanes div[aria-labelledby='${newActive}']`)
            pane.setAttribute('aria-expanded','true')
            pane.setAttribute('aria-hidden','false')
            pane.style.display = 'block'
            let tab = document.querySelector(`#adminToolsTabNav li[aria-labelledby='${newActive}']`)
            tab.setAttribute('tabindex','0')
            tab.setAttribute('aria-selected','true')
            tab.classList.add('ui-tabs-active', 'ui-state-active')
        }

        //Add click-function to native tools and add them to an array so I can know which tools are native
        for (const nativetool of [...document.querySelectorAll('#adminToolsTabNav li a')]){
            nativetool.addEventListener('click', window.cooladmintools.internal.tabclick, false)
            window.cooladmintools.internal.nativeTools.push(nativetool.id)
        }
        //And remember start tool
        window.cooladmintools.internal.activeTool = window.cooladmintools.internal.nativeTools[0]
    }

    /*****************************************/
    /* Adding functions for Canvas API calls */
    /*****************************************/
    function addCanvasAPI(){
        let api = window.cooladmintools.canvasAPI
        api.cancelGetAll = false
        api.get = async function (last_part_of_url){
            //Does a Canvas API call and returns a JS-object.
            let url = location.origin+'/api/v1/'+last_part_of_url
            if (url.indexOf('?')==-1) url+='?per_page=100';
            else if (url.indexOf('per_page=')==-1) url+='&per_page=100';
            let response = await fetch(url);

            return response.json();
        }
        api.getAll = async function (last_part_of_url,feedback=function(nextpage,lastpage){}){
            //Does a Canvas API until no more pages and returns a JS-Array.
            let returnArray = [];
            let url = location.origin+'/api/v1/'+last_part_of_url;
            if (url.indexOf('?')==-1) url+='?per_page=100';
            else if (url.indexOf('per_page=')==-1) url+='&per_page=100';
            do {
                if (api.cancelGetAll){
                    api.cancelGetAll = false
                    throw new Error ('GetAll aborted')
                }
                let response = await fetch(url);
                if (!response.ok){
                    console.log (response);
                    if (response.status == '403'){
                        //Forbidden
                        let data = await response.text();
                        console.log (data);
                        await sleep(1000);
                        continue;
                    }else{
                        console.log (response.status);
                        console.log ("Throw error?");
                        break;
                    }
                }
                Array.prototype.push.apply(returnArray, await response.json());
                console.log (response.headers.get('Link'))
                let lastlink = /<([^>]*)>; rel="last"/.exec(response.headers.get('Link'));
                let lastpage = lastlink?/page=(\d+)/.exec(lastlink[1])[1]:false
                let links = /<([^>]*)>; rel="next"/.exec(response.headers.get('Link'));
                url = links?links[1]:false;
                if (url){
                    let nextpage = /page=(\d+)/.exec(url)[1];
                    feedback(nextpage,lastpage);
                }
            }while (url);
            return returnArray;
        }
        api.put = async function (last_part_of_url, inputdata){
            //Does a Canvas API PUT call and returns a JS-object.
            let csrf_token = decodeURIComponent(document.cookie.split(';').find((item) => item.trim().startsWith('_csrf_token')).replace(/\s*_csrf_token\s*\=\s*(.*)$/,"$1"));
            let response = await fetch(location.origin+'/api/v1/'+last_part_of_url,{method: 'PUT', headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf_token}, body: JSON.stringify(inputdata)});
            return await response.json();
        }
        api.post = async function (last_part_of_url,inputdata){
            //Does a Canvas API POST call and returns a JS-object.
            let csrf_token = decodeURIComponent(document.cookie.split(';').find((item) => item.trim().startsWith('_csrf_token')).replace(/\s*_csrf_token\s*\=\s*(.*)$/,"$1"));
            let response = await fetch(location.origin+'/api/v1/'+last_part_of_url,{method: 'POST', headers: {'Content-Type': 'application/json', 'x-csrf-token': csrf_token}, body: JSON.stringify(inputdata)});
            return await response.json();
        }
        api.qraphql = async function (querydata){
            //get csrf_token from the pages cookie
            let csrf_token = decodeURIComponent(document.cookie.split(';').find((item) => item.trim().startsWith('_csrf_token')).replace(/\s*_csrf_token\s*\=\s*(.*)$/,"$1"))
            if (typeof(querydata)=="string") querydata = {'query': querydata}
            //create the graphql query using the querydata input
            const response = await fetch(location.origin+"/api/graphql",{
                method: 'POST',
                mode: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json+canvas-string-ids, application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrf_token
                },
                body: JSON.stringify(querydata)
            });
            if (response.status != 200){
                console.log (response)
                alert("Noe gikk galt med spørringen")
                throw new Error(`GraphQL feilet :${response.statusText} (${response.status})`);
            }
            //return the response as a json object
            return await response.json()
        }
    }
    /*******************************************************/
    /* Adding useful functions for cooladmintools, language, page and data */
    /*******************************************************/
    function addCoolAPI(){
        let api = window.cooladmintools.coolAPI
        api.addTool = function(toolLabel, toolID=createRandomPrefix(5)){
            //This function will be called by other scripts to register the tools
            document.querySelector('#adminToolsTabNav').insertAdjacentHTML('beforeend',`<li id="${toolID}Tab" class="ui-state-default ui-corner-top" role="tab" tabindex="-1" aria-controls="${toolID}Pane" aria-labelledby="${toolID}Button" aria-selected="false"><a class="ui-tabs-anchor" role="presentation" tabindex="-1" id="${toolID}Button">${toolLabel}</a></li>`)
            document.querySelector('#adminToolsTabPanes').insertAdjacentHTML('beforeend',`<div id="${toolID}Pane" aria-labelledby="${toolID}Button" class="ui-tabs-panel ui-widget-content ui-corner-bottom" role="tabpanel" aria-expanded="false" aria-hidden="true" style="display: none;" />`)
            document.querySelector(`#${toolID}Button`).addEventListener('click', window.cooladmintools.internal.tabclick, false)
            return document.getElementById(toolID+'Pane')
        }
        api.getAllCourses = function(){
            return JSON.parse(JSON.stringify(window.cooladmintools.internal.courses))
        }
        api.getTermInfo = function(){
            return JSON.parse(JSON.stringify({info:window.cooladmintools.internal.terms,sorted:window.cooladmintools.internal.sortedTerms}))
        }
        api.addCSS = function (css){
            let style = document.createElement('style')
            style.type = 'text/css'
            style.innerText = css
            document.head.appendChild(style)
        }
        api.loadJS = function (url){
            let script = document.createElement('script')
            script.src = url
            document.head.appendChild(script)
        }

    }

    /*********************************************************/
    /* Loading course and term data and make filter function */
    /*********************************************************/
    async function getCoursesAndTermsWithGraphQL(){
        const api = window.cooladmintools.canvasAPI
        let starttime = Date.now()
        document.querySelector('#content h1').insertAdjacentHTML("beforeend",'<span id="cooladmintoolsloadstuff"><span id="loadingtime" style="font-size:small; margin-left: 1em;"> </span></span>')
        let timespan = document.getElementById('loadingtime')
        function updateTime(){
            let elapsed = Math.floor((Date.now()-starttime)/1000)
            let minutes = Math.floor(elapsed/60)
            let seconds = elapsed%60
            if (seconds<10) seconds = '0'+seconds
            timespan.textContent = `Laster data (${minutes}:${seconds})`
        }

        const courseQuery = `query MyQuery {account(id: "${ENV.ACCOUNT_ID}") {coursesConnection {nodes {_id sisId name courseCode state createdAt term {_id name startAt endAt} account {_id name}}}}}`
        let timeInterval = setInterval(updateTime, 1000);
        let result = await api.qraphql(courseQuery)
        window.cooladmintools.internal.courses = result.data.account.coursesConnection.nodes.map(node=>{return {id:node._id, sisId:node.sisId, name:node.name, courseCode:node.courseCode, state:node.state, createdAt:node.createdAt, term:node.term._id, accountId:node.account._id, accountName:node.account.name}})
        const terms = window.cooladmintools.internal.terms
        for (const course of result.data.account.coursesConnection.nodes){
            terms[course.term._id]={name:course.term.name,start:course.term.startAt,end:course.term.endAt}
        }
        clearInterval(timeInterval)
        document.getElementById('cooladmintoolsloadstuff')?.remove()
    }

    async function getCoursesAndTermsWithREST(){
        const api = window.cooladmintools.canvasAPI
        function progressbar(nextpage,lastpage){
            let span = document.getElementById('progressindicator')
            if (span) span.textContent = `(${nextpage})`
        }
        document.querySelector('#content h1').insertAdjacentHTML("beforeend",'<span id="cooladmintoolsloadstuff"><button type="button" id="avbrytkurslasting" style="margin: 0 1em 0 1em;">Avbryt lasting av kursliste</button><span id="progressindicator" style="font-size:small"> </span></span>')
        document.getElementById('avbrytkurslasting').onclick = (e)=>{api.cancelGetAll = true}
        let result = await api.getAll(`/accounts/${ENV.ACCOUNT_ID}/courses?include[]=term&include[]=account_name`,progressbar)
        window.cooladmintools.internal.courses = result.map(course=>{return {id:course.id.toString(), sisId:course.sis_course_id, name:course.name, courseCode:course.course_code, state:course.workflow_state, createdAt:course.created_at, term:course.enrollment_term_id.toString(), accountId:course.account_id.toString(), accountName:course.account_name}})
        const terms = window.cooladmintools.internal.terms
        for (const course of result){
            terms[course.enrollment_term_id]={name:course.term.name,start:course.term.start_at,end:course.term.end_at}
        }
        document.getElementById('cooladmintoolsloadstuff')?.remove()

    }

    async function loadAccountInfoAndMakeFilterfunction(){
        let termsort = {}
        termsort['date'] = function(a,b){
            let starta = Date.parse(terms[a].start)
            let startb = Date.parse(terms[b].start)
            if (starta < startb) return -1
            if (starta > startb) return 1
            let enda = Date.parse(terms[a].end)
            let endb = Date.parse(terms[b].end)
            if (enda < endb) return -1
            if (enda > endb) return 1
            return terms[a].name < terms[b].name?-1:1
        }
        termsort['uio'] = function(a,b){
            //Sort algorithm for terms at UiO - propably needs to be changed for other institutions.
            const aarstid = {'VÅR':0, 'SOM':1, 'HØST':2};
            let matcha = /(\d+) ([A-ZÆØÅ]+)(-(\d+) ([A-ZÆØÅ]+))?/.exec(terms[a].name);
            let matchb = /(\d+) ([A-ZÆØÅ]+)(-(\d+) ([A-ZÆØÅ]+))?/.exec(terms[b].name);
            if (!matcha && !matchb) return a>b?1:-1;
            if (!matcha) return 1;
            if (!matchb) return -1;
            if (matcha[1]>matchb[1]) return 1;
            if (matcha[1]<matchb[1]) return -1;
            if (aarstid[matcha[2]]>aarstid[matchb[2]]) return 1;
            if (aarstid[matcha[2]]<aarstid[matchb[2]]) return -1;
            if (!matchb[3]) return 1;
            if (!matcha[3]) return -1;
            if (matcha[4]>matchb[4]) return 1;
            if (matcha[4]<matchb[4]) return -1;
            if (aarstid[matcha[5]]>aarstid[matchb[5]]) return 1;
            return -1;
        }

        const api = window.cooladmintools.canvasAPI
        window.cooladmintools.internal.terms = {}
        const terms = window.cooladmintools.internal.terms
        console.log (terms)
        //Get all courses in the account
        if (alwaysREST || RESTon.includes(ENV.ACCOUNT_ID)){
            await getCoursesAndTermsWithREST()
        }else{
            try {
                await getCoursesAndTermsWithGraphQL()
            }catch(e){
                document.getElementById('cooladmintoolsloadstuff')?.remove()
                await getCoursesAndTermsWithREST()
            }
        }
        console.log ("Kursliste")
        console.log (window.cooladmintools.internal.courses)
        let termsArray = Object.keys(terms)
        let pastTermsArray = []
        let futureTermsArray = []
        let currentTermsArray = []
        const now = Date.now()
        for (const term of termsArray){
            const start = terms[term].start?Date.parse(terms[term].start):false
            const end = terms[term].end?Date.parse(terms[term].end):false
            if (end && end < now) pastTermsArray.push(term)
            else if (start && start > now) futureTermsArray.push(term)
            else currentTermsArray.push(term)
        }

        window.cooladmintools.internal.sortedTerms = {all:termsArray.sort(termsort[termSortAlg]), past:pastTermsArray.sort(termsort[termSortAlg]), future:futureTermsArray.sort(termsort[termSortAlg]), current:currentTermsArray.sort(termsort[termSortAlg])}


        //Object to store references to callback functions. Prefix is used as key.
        window.cooladmintools.internal.callbackfunctions = {}

        window.cooladmintools.internal.filtercourses = function (prefix){
            //Called when the user click on the filter button
            //find the html elements used for filtering
            const termselector = document.getElementById(prefix+'term-select')
            const nameinput = document.getElementById(prefix+'name-input')
            const codeinput = document.getElementById(prefix+'code-input')
            const sisinput = document.getElementById(prefix+'sis-input')
            const stateselector = document.getElementById(prefix+'state-select')
            const fromdate = document.getElementById(prefix+'fromdate')
            const todate = document.getElementById(prefix+'todate')
            //gather the data used for filtering
            let terms=[...termselector.selectedOptions].map(opt=>opt.value)
            if (!terms.length) terms = [...termselector.options].map(opt=>opt.value)//if none is selected, use all
            let name=new RegExp(nameinput.value)//empty regexp matches everything
            let code=new RegExp(codeinput.value)//empty regexp matches everything
            let sis=new RegExp(sisinput.value)//empty regexp matches everything
            let states=[...stateselector.selectedOptions].map(opt=>opt.value)
            if (!states.length) states = [...stateselector.options].map(opt=>opt.value)//if none is selected, use all
            let fromD = Date.parse(fromdate.value)
            let toD = Date.parse(todate.value)
            //create array of filtered courses
            let filteredcourses = []
            let allcourses = window.cooladmintools.internal.courses
            for (const course of allcourses){
                const coursecreated = Date.parse(course.createdAt)
                if (terms.includes(course.term) && name.test(course.name) && code.test(course.courseCode) && sis.test(course.sisId) && states.includes(course.state) && (!fromD || fromD < coursecreated) && (!toD || toD > coursecreated)){
                    filteredcourses.push(course)
                }
            }
            console.log (filteredcourses)
            let feedbackspan = document.getElementById(prefix+'numsearchresult')
            feedbackspan.innerHTML = `${filteredcourses.length} kurs er valgt.`

            window.cooladmintools.internal.callbackfunctions[prefix](JSON.parse(JSON.stringify(filteredcourses))) //Return a completely duplicated data structure with the filtered courses so the tool can do whatever it want with it without risking destroying the original data

        }

        window.cooladmintools.coolAPI.makeFilter = function (div,callback,deleted="none",prefix=createRandomPrefix(5),config=["term","name","coursecode","sisid","state","created"]){
            //This function is called by the admin tools to create gui and functionality to filter the courses in the current account.
            //When the user clicks filter, the result is sent to the callback-function in the form of an array.

            //Store reference to callback function for later use.
            window.cooladmintools.internal.callbackfunctions[prefix]=callback

            //create the html
            let html = `<form><fieldset><legend>Filtrer kursene (${window.cooladmintools.internal.courses.length} kurs totalt)</legend><div style="display:flex; flex-wrap:wrap; gap:10px;"><image src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">`
            if (config.includes('term')){
                let sortedTerms = window.cooladmintools.internal.sortedTerms.all
                let terms = window.cooladmintools.internal.terms
                let selectionbox = `<select name="terms" id="${prefix}term-select" multiple size="9">`
                if (window.cooladmintools.internal.sortedTerms.current.length){
                    selectionbox += '<optgroup label="Pågående semestre">'
                    for (const term of window.cooladmintools.internal.sortedTerms.current){
                        selectionbox += `<option value="${term}">${terms[term].name}</option>`
                    }
                    selectionbox += '</optgroup>'
                }
                if (window.cooladmintools.internal.sortedTerms.future.length){
                    selectionbox += '<optgroup label="Fremtidige semestre">'
                    for (const term of window.cooladmintools.internal.sortedTerms.future){
                        selectionbox += `<option value="${term}">${terms[term].name}</option>`
                    }
                    selectionbox += '</optgroup>'
                }
                if (window.cooladmintools.internal.sortedTerms.past.length){
                    selectionbox += '<optgroup label="Tidligere semestre">'
                    for (const term of window.cooladmintools.internal.sortedTerms.past){
                        selectionbox += `<option value="${term}">${terms[term].name}</option>`
                    }
                    selectionbox += '</optgroup>'
                }
                selectionbox += '</select>'
                html += `<div><label for="${prefix}term-select">Velg semestre:</label><br>${selectionbox}</div>`
            }
            if (config.includes('name')||config.includes('coursecode')){
                let nameselection = '<div>'
                if (config.includes('name')){
                    nameselection += `<label for="${prefix}name-input">Søkestreng for kursnavn:</label><br><input type="text" id="${prefix}name-input" name="name input" size="50"><br>`
                }
                if (config.includes('coursecode')){
                    nameselection += `<label for="${prefix}code-input">Søkestreng for kurskode:</label><br><input type="text" id="${prefix}code-input" name="code input" size="50"><br>`
                }
                if (config.includes('sisid')){
                    nameselection += `<label for="${prefix}code-input">Søkestreng for sis-id:</label><br><input type="text" id="${prefix}sis-input" name="code input" size="50">`
                }
                nameselection += '</div>'
                html += nameselection
            }
            let possiblestates
            let statevisible = deleted=="only"?'style="display:none"':''
            if (config.includes('state')){
                switch (deleted){
                    case "only": possiblestates = ["deleted"]; break;
                    case "include": possiblestates = ['created','claimed','available','completed','deleted']; break;
                    case "none":
                    default: possiblestates = ['created','claimed','available','completed']
                }
                let stateselection = `<select name="state" id="${prefix}state-select" ${statevisible} multiple size="5">`
                for (const state of possiblestates){
                    stateselection += `<option value="${state}">${state}</option>`
                }
                stateselection += '</select>'
                html += `<div><label for="${prefix}state-select">Velg kursstatuser:</label><br>${stateselection}</div>`
            }
            if (config.includes('created')){
                html += `<div><label for="${prefix}fromdate">Opprettet fra:</label><br><input type="date" id="${prefix}fromdate" name="from date"><br><label for="${prefix}todate">Opprettet før:</label><br><input type="date" id="${prefix}todate" name="to date"></div>`
            }
            html += `</div><button type="button" onclick="javascript:window.cooladmintools.internal.filtercourses('${prefix}')">Filtrer</button> <span id="${prefix}numsearchresult"> </span>`
            html += '</fieldset></form>'
            div.innerHTML = html
        }
    }

    /******************************************************/
    /* Initialize cooladmintools and add useful functions */
    /******************************************************/
    async function init2(){

    }
    async function init(){
        createCoolAdminToolsObject()
        addCanvasAPI()
        addCoolAPI()
        await loadAccountInfoAndMakeFilterfunction()
        //...
        window.cooladmintools.done = true
    }


    /***********************************************************/
    /* Wait for page to load before initiaziing cooladmintools */
    /***********************************************************/
    function wait(){
        let adminToolsTabs = document.getElementById('adminToolsTabs');
        if (adminToolsTabs){ //page is loaded,
            observer.disconnect(); //so don't want to call this anymore
            init()
        }
    }

    let observer = new MutationObserver(wait);
    observer.observe(document.getElementById('content'), { attributes: false, childList: true, subtree: true });
    wait()
})();
