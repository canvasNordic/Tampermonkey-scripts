# Configuration of the central script

After the comment blocks in the top, the actual code starts:
```js
(function() {
    'use strict';

    /*******************/
    /* Config settings */
    /*******************/
    const alwaysREST = false //Always use REST API to collect courselist
    const RESTon = [1] //Use REST API to collect courselist on these accounts
    const termSortAlg = 'date' //uio,date
```
## AlwaysREST
You will normally want to have this set to false. The central script will try to use one GraphQL request to get the course list instead of using multiple REST requests. 
Using one GraphQL request will be faster than using multiple REST requestes. However, sometimes there are so many courses that the GraphQL request will give time out. 
The central script will then use the REST api instead, but will have wasted a considerable time. This can be solved using the RESTon variable described under, but if
you don't want to bother with that and often run into the problem, you can choose to always use REST.

## RESTon
You can insert a comma separated list of accounts where you run into the problem of GraphQL timing out. E.x. [1,23,29,255]. You can of course also have a completely empty array, [].

## termSortAlg
When filtering the courses, the user can choose one or more terms to filter the courses. To make that experience nice, the terms needs to be sorted.

The date sorting algorithm sorts the terms by first checking the start date, then the end date, and if both are identical it sorts the name alphabetical.

The uio sorting algorithm is tailored for University of Oslo where the start date isn't set, and sorting it after the end date isn't very logical.
It extracts year and term info from the term name and then use that to sort it after start date and end date, and if it can't extract this info it is sorted after the name.
