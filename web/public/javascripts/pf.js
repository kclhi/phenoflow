function sendPostRequest(endpoint, body, callback, contentType='application/json') {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:3000/" + endpoint, true);
  if (contentType) xhr.setRequestHeader('Content-Type', contentType);
  xhr.onreadystatechange = function() {
    if(xhr.readyState === XMLHttpRequest.DONE) {
      var status = xhr.status;
      if (status === 0 || (status >= 200 && status < 400)) {
        callback(xhr.response);
      } else {
        callback(null);
      }
    }
  };
  xhr.send(body);
}

function workflow(url, name, author, about, callback) { sendPostRequest(url, JSON.stringify({"name": name, "author": author, "about": about}), callback); }

function createWorkflow(name, author, about, callback) { workflow("phenotype/new", name, author, about, callback); }

function updateWorkflow(id, name, author, about, callback) { workflow("phenotype/update/" + id, name, author, about, callback); }

//

function step(url, name, doc, type, position, workflowId, callback) { sendPostRequest(url, JSON.stringify({"name": name, "doc": doc, "type": type, "position": position, "workflowId": workflowId}), callback); }

function createStep(name, doc, type, position, workflowId, callback) { step("step/new", name, doc, type, position, workflowId, callback); }

function updateStep(name, doc, type, newPosition, workflowId, position, callback) { step("step/update/" + workflowId + "/" + position, name, doc, type, newPosition, null, callback); }

//

function input(url, doc, stepId, callback) { sendPostRequest(url, JSON.stringify({"doc": doc, "stepId": stepId}), callback); }

function createInput(doc, stepId, callback=function(response){}) { input("input/new", doc, stepId, callback); }

function updateInput(doc, stepId, callback=function(response){}) { input("input/update/" + stepId, doc, stepId, callback=function(){}); }

//

function output(url, doc, extension, stepId, callback) { sendPostRequest(url, JSON.stringify({"doc": doc, "extension": extension, "stepId": stepId}), callback); }

function createOutput(doc, extension, stepId, callback=function(response){}) { output("output/new", doc, extension, stepId, callback); }

function updateOutput(doc, extension, stepId, callback=function(response){}) { output("output/update/" + stepId, doc, extension, stepId, callback=function(){}); }

//

function implementation(url, file, language, stepId, callback) {
  var data = new FormData();
  data.append("implementation", file);
  data.append("language", language);
  data.append("stepId", stepId);
  sendPostRequest(url, data, callback, null)
}

function createImplementation(file, language, stepId, callback=function(response){}) { implementation("implementation/new", file, language, stepId, callback); }

function updateImplementation(file, newLanguage, stepId, language, callback=function(response){}) { implementation("implementation/update/" + stepId + "/" + language, file, newLanguage, stepId, callback=function(){}); }

//

function downloadWorkflow() {

}
