function sendPostRequest(endpoint, body, callback, contentType='application/json') {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/phenoflow/" + endpoint, true);
  if (contentType) xhr.setRequestHeader('Content-Type', contentType);
  const idToken = localStorage.getItem("id_token");
  if (idToken) xhr.setRequestHeader("Authorization", "Bearer " + idToken);
  xhr.onreadystatechange = function() {
    if(xhr.readyState === XMLHttpRequest.DONE) {
      var status = xhr.status;
      if (status === 0 || (status >= 200 && status < 400)) {
        callback(xhr.response);
      } else {
        console.log(xhr.statusText);
        callback(null);
      }
    }
  };
  xhr.send(body);
}

function workflow(url, name, author, about, callback=function(response){}) { sendPostRequest(url, JSON.stringify({"name": name, "author": author, "about": about}), callback); }

function createWorkflow(name, author, about, callback=function(response){}) { workflow("phenotype/new", name, author, about, callback); }

function updateWorkflow(id, name, author, about, callback=function(response){}) { workflow("phenotype/update/" + id, name, author, about, callback); }

function step(workflowId, position, name, doc, type, callback) { sendPostRequest("step/" + workflowId + "/" + position, JSON.stringify({"name": name, "doc": doc, "type": type}), callback); }

function deleteStep(workflowId, position, callback=function(response){}) { sendPostRequest("step/delete/" + workflowId + "/" + position, "", callback); }

function input(stepId, doc, callback=function(response){}) { sendPostRequest("input/" + stepId, JSON.stringify({"doc": doc}), callback); }

function output(stepId, doc, extension, callback=function(response){}) { sendPostRequest("output/" + stepId, JSON.stringify({"doc": doc, "extension": extension}), callback); }

function implementation(stepId, language, file, callback=function(response){}) {
  var data = new FormData();
  data.append("implementation", file);
  sendPostRequest("implementation/" + stepId + "/" + language, data, callback, null)
}
