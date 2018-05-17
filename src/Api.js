var API;
$(document).ready(function () {
    API = new function () {

        //#region Declarations

        var HTTP_RESPONSE_STATUS_OK = "200";
        var REQUEST_TYPE_GET = "GETPARAM";
        var REQUEST_TYPE_PUT = "PUTPARAM";
        var REQUEST_TYPE_EXIT = "EXITAU";

        var LESSON_STATUS_PASSED = "p";
        var LESSON_STATUS_FAILED = "f";
        var LESSON_STATUS_COMPLETED = "c";
        var LESSON_STATUS_BROWSED = "b";
        var LESSON_STATUS_INCOMPLETE = "i";
        var LESSON_STATUS_NOT_ATTEMPTED = "n";

        var AICC_SID;
        var AICC_URL;
        var objLog;

        // PostData
        var AICC_Lesson_Location = "";
        var AICC_Lesson_Status = LESSON_STATUS_NOT_ATTEMPTED;
        var AICC_Score = "";
        var AICC_Time = "";
        var AICC_Comments = "";
        var AICC_Objectives_Status = "";
        var AICC_Student_Preferences = "";
        var AICC_Audio = 0;
        var AICC_Language = "";
        var AICC_Speed = 100;
        var AICC_Text = 0;
        var AICC_Data_Chunk = "";

        // Parsed Data
        var AICC_LMS_Version = "";
        var AICC_Student_ID = "";
        var AICC_Student_Name = "";
        var AICC_Mastery_Score = "";
        var AICC_CourseID = "";

        //#endregion

        init();


        this.setPassed = function () { setStatus(LESSON_STATUS_PASSED); };
        this.setFailed = function () { setStatus(LESSON_STATUS_FAILED); };
        this.setCompleted = function () { setStatus(LESSON_STATUS_COMPLETED); };
        this.setBrowsed = function () { setStatus(LESSON_STATUS_BROWSED); };
        this.setIncomplete = function () { setStatus(LESSON_STATUS_INCOMPLETE); };
        this.setNotAttempted = function () { setStatus(LESSON_STATUS_NOT_ATTEMPTED); };
        this.setLessonLocation = function (value) { AICC_Lesson_Location = value; put(); };
        this.getLessonLocation = function () { return AICC_Lesson_Location; };

        function setStatus(strStatus) {
            AICC_Lesson_Status = strStatus;
            put();
        }

        function init() {
            $('body').append('<div id="apiLog"><b>AICC Debug Log</b><br></div>');
            objLog = $('#apiLog');

            // load values from the querystring
            var queryString = getQueryString();
            AICC_SID = queryString["AICC_SID"];
            AICC_URL = queryString["AICC_URL"];

            // load the initial state from the lms
            performHttpRequestToLMS(REQUEST_TYPE_GET, "");

            $(window).unload(function () {
                exit();
            });
        }

        function exit() {
            log('Exiting by sending PUT command, then sending EXIT command to LMS...');
            performHttpRequestToLMS(REQUEST_TYPE_PUT);
            performHttpRequestToLMS(REQUEST_TYPE_EXIT);
        };

        function put() {
            performHttpRequestToLMS(REQUEST_TYPE_PUT);
        };

        function performHttpRequestToLMS(strRequestType) {

            var data = "";
            if (strRequestType == REQUEST_TYPE_PUT) {
                data = serializeAiccData();
            }

            // construct a form and post the data to the LMS
            var error = false;
            var httpRequest;
            try {
                httpRequest = new XMLHttpRequest;
                httpRequest.open("POST", AICC_URL, false);
            }
            catch (e) {
                error = true;
                completeHttpRequest(e.name, strRequestType, data, '', e.number, e.message);
            }
            if (error == false) {
                httpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                var strPostData = "session_id=" + encodeURIComponent(AICC_SID) +
                    "&version=3.5" +
                    "&command=" + encodeURIComponent(strRequestType) +
                    "&aicc_data=" + encodeURIComponent(data);

                httpRequest.send(strPostData);

                completeHttpRequest(httpRequest.statusText, strRequestType, data, httpRequest.responseText, httpRequest.status, httpRequest.statusText);
            }

            //                // firefox, chrome, safari
            //                $.ajax({
            //                    url: AICC_URL,
            //                    type: "GET",
            //                    async: false,
            //                    crossDomain: true,
            //                    data: urlParameters,
            //                    //                   data: {
            //                    //                        session_id: AICC_SID,
            //                    //                        command: strRequestType,
            //                    //                        version: '3.5',
            //                    //                        aicc_data: data
            //                    //                    },
            //                    dataType: "html",
            //                    complete: function (httpRequest, textStatus) {
            //                        var errorMessage = 'HTTP response status: ' + httpRequest.Status + ' - ' + httpRequest.statusText;
            //                        completeHttpRequest(textStatus, strRequestType, data, httpRequest.responseText, httpRequest.Status, errorMessage);
            //                    }
            //                });
        }
        function completeHttpRequest(textStatus, strRequestType, data, responseText, httpStatusCode, errorMessage) {
            log('HTTP request to LMS: ' + textStatus.toUpperCase());
            if (httpStatusCode != HTTP_RESPONSE_STATUS_OK) {
                log('-- ' + errorMessage);
            }
            log('-- URL: <a target="_blank" href="' + AICC_URL + '">' + AICC_URL + '</a>');
            log('-- Sending Session_ID: ' + AICC_SID);
            log('-- Sending Command: ' + strRequestType);
            log('-- Sending Version: 3.5');
            log('-- Sending AICC_DATA:' + formatAiccDataForLog(data));
            log('-- Response received from LMS:' + formatAiccDataForLog(responseText));
            log();
            if ((httpStatusCode == HTTP_RESPONSE_STATUS_OK) && (strRequestType == REQUEST_TYPE_GET)) {
                parseLmsResponse(responseText);
            }
        }

        //#region Parsing methods

        function parseLmsResponse(strHtml) {

            var isValid = isLmsResponseValid(strHtml);
            if (!isValid) return;

            var lines = strHtml.toString().split("\n");
            for (var i = 0; i < lines.length; i++) {
                var strLine = lines[i].toString().replace(/\r/g, "");

                var name = getNameFromAiccLine(strLine);

                if (name != "") {
                    var value = getValueFromAiccLine(strLine);
                    switch (name) {
                        case "version":
                            var tempVersion = parseFloat(value);
                            if (isNaN(tempVersion)) {
                                tempVersion = 0;
                            }
                            AICC_LMS_Version = tempVersion;
                            break;
                        case "student_id":
                            AICC_Student_ID = value;
                            break;
                        case "student_name":
                            AICC_Student_Name = value;
                            break;
                        case "lesson_location":
                            AICC_Lesson_Location = value;
                            break;
                        case "score":
                            AICC_Score = value;
                            break;
                        case "lesson_status":
                            var code = "X";
                            if (value.length > 0) {
                                code = value.charAt(0).toLowerCase();
                            }
                            switch (code) {
                                case LESSON_STATUS_PASSED:
                                case LESSON_STATUS_FAILED:
                                case LESSON_STATUS_COMPLETED:
                                case LESSON_STATUS_BROWSED:
                                case LESSON_STATUS_INCOMPLETE:
                                case LESSON_STATUS_NOT_ATTEMPTED:
                                    AICC_Lesson_Status = code;
                                    break;
                                default:
                                    AICC_Lesson_Status = LESSON_STATUS_NOT_ATTEMPTED;
                            }
                            break;
                        case "time":
                            AICC_Time = value;
                            break;
                        case "mastery_score":
                            AICC_Mastery_Score = value;
                            break;
                        case "audio":
                            AICC_Audio = value;
                            break;
                        case "speed":
                            AICC_Speed = value;
                            break;
                        case "course_id":
                            AICC_CourseID = value;
                            break;
                    }
                }
            }
        }

        function isLmsResponseValid(strHtml) {

            // search the html for an error message
            var strErrorNumber = "";
            var strErrorText = "";
            var lines = strHtml.toString().split("\n");
            for (var i = 0; i < lines.length; i++) {
                var strLine = lines[i].toString().replace(/\r/g, "");
                if (strLine.toLowerCase().indexOf("error") > -1) {
                    if (strLine.toLowerCase().indexOf("error_text") > -1) strErrorText = strLine;
                    else strErrorNumber = strLine;
                }

            }

            if (strErrorNumber == "") {
                // probably a 404 error or LMS exploded
                log('LMS response is not valid:');
                log('-- Error number: ' + strErrorNumber);
                log('-- Error text: ' + strErrorText);
                log();
                warn("ERROR - LMS did not return a valid error number");
                return false;
            } else if (strErrorNumber != "" && strErrorNumber.toLowerCase().search(/error\s*=\s*0/) == -1) {
                log('LMS returned an error:');
                log('-- Error number: ' + strErrorNumber);
                log('-- Error text: ' + strErrorText);
                log();
                warn("ERROR - LMS returned a error number: " + strErrorNumber + " - " + strErrorText);
                return false;
            } else {
                return true;
            }
        }

        function getValueFromAiccLine(strLine) {
            var strValue = "";
            strLine = new String(strLine);
            var i = strLine.indexOf("=");

            if (i > -1 && ((i + 1) < strLine.length)) {
                var strTemp = strLine.substring(i + 1);
                strTemp = strTemp.replace(/^\s*/, "");
                strTemp = strTemp.replace(/\s*$/, "");
                strValue = strTemp;
            }
            return strValue;
        }

        function getNameFromAiccLine(strLine) {
            var i;
            var strTemp;
            var strName = "";
            strLine = new String(strLine);
            i = strLine.indexOf("=");
            if (i > -1 && i < strLine.length) {
                strTemp = strLine.substring(0, i);
                strTemp = strTemp.replace(/^\s*/, "");
                strTemp = strTemp.replace(/\s*$/, "");
                strName = strTemp;
            } else {
                i = strLine.indexOf("[");
                if (i > -1) {
                    strTemp = strLine.replace(/[\[|\]]/g, "");
                    strTemp = strTemp.replace(/^\s*/, "");
                    strTemp = strTemp.replace(/\s*$/, "");
                    strName = strTemp;
                }
            }
            return strName;
        }

        //#endregion

        //#region Utility methods

        function getQueryString() {
            // returns a json object providing access to the QueryString
            // using syntax like this: var id = obj["id"];

            var queryString = {};
            (function () {
                var e,
                    a = /\+/g, // Regex for replacing addition symbol with a space
                    r = /([^&=]+)=?([^&]*)/g,
                    d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
                    q = window.location.search.substring(1);

                while (e = r.exec(q))
                    queryString[d(e[1])] = d(e[2]);
            })();
            return queryString;
        }

        function formatAiccDataForLog(strAiccData) {
            //replace line breaks with br tags
            strAiccData = $.trim(strAiccData);
            if (strAiccData == '') strAiccData = '[none]';
            strAiccData = '\r\n' + strAiccData;
            return strAiccData.replace(/\r\n/gi, "<br>---- ");
        }

        function serializeAiccData() {
            var data = "[Core]\r\n";
            data += "Lesson_Location=" + AICC_Lesson_Location + "\r\n";
            data += "Lesson_Status=" + AICC_Lesson_Status + "\r\n";
            data += "Score=" + AICC_Score + "\r\n";
            data += "Time=" + AICC_Time + "\r\n";
            data += "[Comments]\r\n" + AICC_Comments + "\r\n";
            data += "[Objectives_Status]\r\n" + AICC_Objectives_Status + "\r\n";
            data += "[Student_Preferences]\r\n";
            data += "Audio=" + AICC_Audio + "\r\n";
            data += "Language=" + AICC_Language + "\r\n";
            data += "Speed=" + AICC_Speed + "\r\n";
            data += "Text=" + AICC_Text + "\r\n";
            data += "[Core_Lesson]\r\n";
            data += AICC_Data_Chunk;
            return data;
        }

        function log(str) {
            if (str == undefined) str = '';
            objLog.append(str + '<br/>');
        }

        function warn(str) {
            str += "\r\n\r\nCheck the debug log for more details.";
            alert(str);
        }

        //#endregion
    };
});