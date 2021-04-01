
function sendquestionnaire() {

    let form = document.querySelector('#questionnaireform');
    let formdata = new FormData(form);
    let data={}

    for (var [key, value] of formdata.entries()) { 
      data[key] = value
    }

    let url="phenotype/questionnaire/postquestionnaire"
    let datajsons=JSON.stringify(data)
    let callback=function(response){
      //console.log("posted"+response)
    }

    sendPostRequest(url, datajsons, callback, contentType='application/json')

    window.close();    
  
  }
  