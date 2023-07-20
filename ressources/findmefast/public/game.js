
var GAME=GAME||{};

GAME.gameStart = (function(){


	var pageCourante="#jeu";
	var id=0;
	var timer=0;
	// ETAPE 1 : la connexion
	var sock=io.connect();
	//TODO : précharger les svg pour éviter le FOUC
	
	/****************** Partie socket **************************/
	//accusé de reception de la connexion au serveur
	//TODO : surtout utile en cas de  reconnexion !!! 
	sock.on("accuse",function(data){
		console.log(data);
		id=data.id;
		reset();
		//preload images
		for (var i = data.images.length - 1; i >= 0; i--) {
			var img = new Image();
			img.onload=function(){
				console.log("fin préchargement de l'images "+this.src);
			};
			img.src='images/'+data.images[i];
		}
	});




	//affichage des messages d'erreur
	sock.on("erreur",function(data){
		var erreurbox = document.getElementById("messages");
		erreurbox.querySelector("p").innerHTML=data.message;
		addClass(erreurbox,"front");
	});




	// message recu declenchant le passage en mode jeu
	sock.on("jeu",function(data){
		console.log(data.partie);
		//affichage des joueurs
		for (var i = 0; i < data.joueurs.length; i++) {
			var j = data.joueurs[i];
			//console.log("Affichage des joueurs : "+j.id+" / "+id);
			majListeJoueurs(j);
		};
		switchPage("#jeu");
		//TODO afficher attente
	});




	// info : un nouveau joueur se connecte dans notre partie
	sock.on("joueur",function(data){
		console.log(data.joueur);
		majListeJoueurs(data.joueur);
	});




	// message reçu pour lister les parties afin d'en rejoindre une
	sock.on("listeParties",function(data){
		console.log(data);
		var options='';
		for(var i=0;i<data.parties.length;i++){
			options+='<option value="'+data.parties[i].id+'" >'+data.parties[i].nom+
			'('+data.parties[i].nbj+')</option>';
		}
		document.getElementById("liste_parties").innerHTML=options;
		switchPage("#lister_parties");
	});





	// message reçu lorsqu'un joueur en mode jeu est prêt (ou ne l'est plus)
	sock.on("pret",function(data){
		console.log("Le joueur "+data.joueur.pseudo+" est "+((data.pret)?"prêt!":"pas prêt"));
		var e=document.querySelector("#joueur"+data.joueur.id+" .icon");
		console.log(e);
		if(data.pret){
			addClass(e,'pret');
		}else{
			removeClass(e,'pret');
		}
	});





	// message reçu indiquant la fin de la partie (le chef de partie s'est deconnecté)
	sock.on("fin",function(data){
		console.log("fin de partie");
		//alert(data);
		console.log("Le joueur "+data.joueur.pseudo+" met fin à la partie...");
		//TODO nettoyage
		//on ramene à l'accueil en faisant du ménage
		//document.getElementById("listeJoueurs").innerHTML="";
		//switchPage("#accueil");
		reset();
	});






	// on recoit un nouveau tour.
	sock.on("tour",function(data){
		console.log("On recoit un tour :");
		console.log(data);
		//traitement du premier tour (joueur forcément prêt)
		if(data.joueur){
			var e=document.querySelector("#joueur"+data.joueur.id+" .icon");
			addClass(e,'pret');
		}
		//si je suis le vainqueur
		if(data.idVainqueur==id){
			console.log("Bonne reponse");		
			var e=document.getElementById("monJeu");
			addClass(e,'gagnant');
			setTimeout(function(){removeClass(e,'gagnant');},500);
		}else{
			var e=document.getElementById("monJeu");
			removeClass(e,'gagnant')
		}
		//met à jour les scores
		for (var i = 0; i < data.joueurs.length; i++) {
			var j = data.joueurs[i];
			console.log(j.id+" a maintenant "+j.score+" points");
			var e=document.querySelector("#joueur"+j.id+" span");
			e.innerHTML=''+j.score;
			//e.appendChild(document.createTextNode(""+j.score));
			//e.innerHTML=j.score;
		};
		//chargement du tas
		document.getElementById("newJeu").innerHTML=donne2html(data.tas,false);
		//chargement du jeu
		document.getElementById("monJeu").innerHTML=donne2html(data.cartes,true);
		//initialisation du timer pour calculer le temps de réaction du joueur
		timer=Date.now();
		//création des liens pour les images
		var liens = document.querySelectorAll('#jeu article a');
		for (var i = 0; i < liens.length; i++) {
			//TODO : les listeners sont ils detruits lorsque le innerHTML est remplacé ?
	 		liens[i].addEventListener("click",function(event){
	 			event.preventDefault();
	 			var target = event.currentTarget.attributes['href'].value || '#accueil';
				console.log(target);
				//TODO deplacer dans une fonction
				//calcul du temps de réaction
				var rapid=Date.now()-timer;
				var carte=target.substr(-1);
				sock.emit("reponse",{carte:carte,rapid:rapid});
				//TODO affiche wait
			},false);
		}
	});






	sock.on("mauvaisereponse",function(data){
		console.log("mauvaisereponse");		
		var e=document.getElementById("monJeu");
		//removeClass(e,'vainqueur');
		addClass(e,'perdant');
		setTimeout(function(){removeClass(e,'perdant');},200);
		//TODO : interdire de jouer
	});






	sock.on("deconnexionJoueur",function(data){
		console.log("Deconnexion du joueur "+data.joueur.id);
		var erreurbox = document.getElementById("messages");
		erreurbox.querySelector("p").innerHTML="Deconnexion du joueur "+data.joueur.id;
		addClass(erreurbox,"front");
		//retirer le joueur de la partie
		var e=document.querySelector("#joueur"+data.joueur.id);
		e.parentNode.removeChild(e);
		//addClass(e,'retire');
		//TODO afficher message?
	});






	//debug
	sock.on("debug",function(data){
		console.log("-----DEBUG-----");
		console.log(data);
	});





	sock.on("reload",function(data){
		console.log("-----RELOAD-----");
		//plus violent , on recharge l'application ???? 
		location.assign(location.href);
		location.reload();
	});







	/****************** Partie interraction *********************/





	////gestion des différents liens de l'aplication
	var liens = document.querySelectorAll('a');
	for (var i = 0; i < liens.length; i++) {
		liens[i].addEventListener("click",function(event){
			event.preventDefault();
			var target = event.currentTarget.attributes['href'].value || '#accueil';
			console.log(target)
			if(target=="#accueil"){
				reset();
			}
			if(target=="#nouvelle_partie"){
				switchPage(target);
			}
			if(target=="#lister_parties"){
				//récupérer les parties
				sock.emit("listerParties",{});
				//TODO : afficher un sablier
			}
			if(target=="#options"){
				switchPage(target);
			}
			if(target=="creer_partie"){
				var nomJoueur = document.getElementById("nom_joueur").value;
				var nomPartie = document.getElementById("nom_partie").value;
				//TODO : vérifier la saisie
				sock.emit("creerPartie",{nomJoueur:nomJoueur,nomPartie:nomPartie});
				//TODO : afficher un sablier
			}
			if(target=="rejoindre_partie"){ //
				//TODO verifier la saisie
				var idPartie = document.getElementById("liste_parties").value;
				var nomJoueur = document.getElementById("nom_joueur_rejoindre").value;
				sock.emit("rejoindrePartie",{idPartie:idPartie,nomJoueur:nomJoueur});
				//TODO : afficher un sablier
			}
			if(target=="pret"){
				sock.emit("pret",{});
				//TODO : afficher un sablier
			}
			if(target=="debug"){
				sock.emit("debug",{});
			}
			if(target=="reset"){
				reset();
				sock.emit("reset",{});
			}
			if(target=="quitterPartie"){
				sock.emit("quitterPartie",{});
				reset();
			}


		},false);
	}





	/* boite des messages d'erreur */
	var erreurbox = document.getElementById("messages");
	erreurbox.querySelector(".action a").addEventListener("click",function(event){
		event.preventDefault();
		removeClass(erreurbox,"front");
	});






/******************* fonctions *******************/




	var reset = function(){
		console.log("petit reset---");
		//les listes de jeu : 
		document.getElementById("liste_parties").innerHTML="";
		document.getElementById("listeJoueurs").innerHTML="";
		document.getElementById("monJeu").innerHTML="";
		document.getElementById("newJeu").innerHTML="";
		switchPage("#accueil");
		if(!id){
			sock.emit("quitterPartie",{});
		}
	}



	var majListeJoueurs = function(joueur){
		var element=document.createElement("li");
		element.id="joueur"+joueur.id;
		attente=(joueur.ready)?"pret":"attente";
		element.innerHTML=joueur.pseudo+'<span class="icon '+attente+'" >0</span>';
		document.getElementById("listeJoueurs").appendChild(element);
	}




	var switchPage = function(newpage){
		var courante = document.querySelector(pageCourante);
		//courante.style.zIndex = 0;
		courante.style.left = '-100%';
		var nouvelle = document.querySelector(newpage);
		//nouvelle.style.zIndex = 1;
		nouvelle.style.left = '0';
		pageCourante=newpage;
	}




	var donne2html = function(cartes,isJoueur){
		var html='<ul>';
		for (var i =0;i<cartes.length;i++) {
			var htmlImg='<img src="images/'+cartes[i].img
			+'" alt="'+i+'" style="width:100%;height:100%;'+
			'transform:rotate('+cartes[i].orientation+'deg);'+
			'-webkit-transform:rotate('+cartes[i].orientation+'deg);" />';
			if(isJoueur){
				htmlImg = '<a href="carte'+i+'" style="left:'
					+(cartes[i].x-cartes[i].r)+'%;top:'+(cartes[i].y-cartes[i].r)
					+'%;width:'+cartes[i].r*2+'%;height:'+cartes[i].r*2
					+'%;" >'+htmlImg+'</a>';
			}else{
				htmlImg = '<div style="left:'+(cartes[i].x-cartes[i].r)
					+'%;top:'+(cartes[i].y-cartes[i].r)
					+'%;width:'+cartes[i].r*2+'%;height:'+cartes[i].r*2
					+'%;" >'+htmlImg+'</div>';
			}
			html+='<li>'+htmlImg+'</li>';
		};
		html+='</ul>';
		return html;


		// var html='<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" >';
		// for (var i =0;i<cartes.length;i++) {

		// 	if(isJoueur){
		// 		htmlImg = '<a xlink:href="carte'+i+'">'+
		// 		'<image x="'+(cartes[i].x-cartes[i].r)+'"'+
		// 			 ' y="'+(cartes[i].y-cartes[i].r)+'"'+
		// 			 ' width="'+cartes[i].r*2+'"'+
		// 			 ' height="'+cartes[i].r*2+'"'+
		// 			 ' transform="rotate('+cartes[i].orientation+')"'+
		// 			 ' xlink:href="images/'+cartes[i].img+'" />'+
		// 		'</a>';
		// 	}else{
		// 		htmlImg = '<image x="'+(cartes[i].x-cartes[i].r)+'"'+
		// 			 ' y="'+(cartes[i].y-cartes[i].r)+'"'+
		// 			 ' width="'+cartes[i].r*2+'"'+
		// 			 ' height="'+cartes[i].r*2+'"'+
		// 			 ' transform="rotate('+cartes[i].orientation+')"'+
		// 			 ' xlink:href="images/'+cartes[i].img+'" />';
		// 	}
		// 	html+=htmlImg;
		// };
		// html+='</svg>';
		// return html;
	}






	/* jouons avec les classes (sans JQuery)*/
	var hasClass = function(elem,className) {
		return new RegExp(' '+className+' ').test(' '+elem.className+' ');
	}
	var addClass = function (elem,className) {
		if (!hasClass(elem,className)) {
			elem.className+=' '+className;
		}
	}
	var removeClass = function (elem, className) {
		//on epure les classes de l'élément
		var newClass=' '+elem.className.replace(/[\t\r\n]/g,' ')+' ';
		if (hasClass(elem, className)) {
			while (newClass.indexOf(' '+className+' ')>=0) {
				newClass=newClass.replace(' '+className+' ',' ');
			}
			//mise à jour
			elem.className=newClass.replace(/^\s+|\s+$/g,'');
		}
	}




});


/******************* Chargement *********************/
if(window.addEventListener){
	window.addEventListener('load', GAME.gameStart, false);
}else{
	window.attachEvent('onload', GAME.gameStart);
}
