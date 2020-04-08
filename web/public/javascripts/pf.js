function sendPostRequest(endpoint, body, callback, contentType='application/json') {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "http://localhost:3000/" + endpoint, true);
  if (contentType) xhr.setRequestHeader('Content-Type', contentType);
  xhr.onload  = function() {
    callback(xhr.response);
  };
  xhr.send(body);
}

function createWorkflow(name, author, about, callback) {
  sendPostRequest("phenotype/new", JSON.stringify({"name": name, "author": author, "about": about}), callback);
}

function createStep(stepId, doc, type, position, workflowId, callback) {
  sendPostRequest("step/new", JSON.stringify({"stepId": stepId, "doc": doc, "type": type, "position": position, "workflowId": workflowId}), callback);
}

function createInput(doc, stepId, callback=function(response){}) {
  sendPostRequest("input/new", JSON.stringify({"doc": doc, "stepId": stepId}), callback);
}

function createOutput(doc, extension, stepId, callback=function(response){}) {
  sendPostRequest("output/new", JSON.stringify({"doc": doc, "extension": extension, "stepId": stepId}), callback);
}

function createImplementation(file, language, stepId, callback=function(response){}) {
  var data = new FormData();
  data.append("implementation", file);
  data.append("language", language);
  data.append("stepId", stepId);
  sendPostRequest("implementation/new", data, callback, null)
}

function downloadWorkflow() {

}
