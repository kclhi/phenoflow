function ready(callback){

  if (document.readyState!='loading') callback();
  else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback)
  else document.attachEvent('onreadystatechange', function(){ if(document.readyState=='complete') callback();});

}

function setSession(authResult) {

  const expiresAt = moment().add(authResult.expiresIn,"second");
  localStorage.setItem("id_token", authResult.idToken);
  localStorage.setItem("expires_at", JSON.stringify(expiresAt.valueOf()) );

}

function logout() {

  localStorage.removeItem("id_token");
  localStorage.removeItem("expires_at");
  for(let authentication of document.getElementsByClassName("authentication")) authentication.style.display = "inherit";
  for(let restricted of document.getElementsByClassName("restricted")) restricted.style.display = "none";

}

function isLoggedIn() { return moment().isBefore(this.getExpiration()); }

function isLoggedOut() { return !this.isLoggedIn(); }

function getExpiration() {

  const expiration = localStorage.getItem("expires_at");
  const expiresAt = JSON.parse(expiration);
  return moment(expiresAt);

}

function login() {

  const user = document.getElementsByClassName("username")[0].value;
  const password = document.getElementsByClassName("password")[0].value;
  if(username && password) sendPostRequest("login", JSON.stringify({"user":user, "password":password}), function(authResult) {

    if(authResult) {
      setSession(JSON.parse(authResult));
      localStorage.setItem("user", user);
      document.getElementsByClassName("username")[0].value = "";
      document.getElementsByClassName("password")[0].value = "";
      for(let authentication of document.getElementsByClassName("authentication")) authentication.style.display = "none";
      for(let restricted of document.getElementsByClassName("restricted")) restricted.style.display = "inherit";
      if(typeof postLogin === "function") postLogin();
    }

  });

}
