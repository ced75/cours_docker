//# Node.js  multiplayer game pattern
//# 2013-10-11
//# Cedricici
(function(){


	/**
	* les dépendances
	*/

	var express = require('express');
	var app = express();
	var server = require('http').createServer(app);
	var io=require('socket.io').listen(server);

	

	//limite le debug verbeux de socket.io
	//io.set('log level', 1);

	/**
	* Initialisation du server HTTP
	*/
	var port = (process.env.PORT)?process.env.PORT:1111;
	server.listen(port);

	/**
	* Traitement des fichiers statiques
	*
	*/
	app.get('/',function(req,res){
	  res.sendFile(__dirname + '/public/game.html');
	});
	app.use(express.static(__dirname + '/public'));


	/********** GESTION DU JEU *************/


	/** 
	* Déclaration des variables de jeu et des constantes
	*/ 
	var joueurs=[];
	var clients=[];
	var parties=[];
	var cheminImage='/images/';
	var images=['penguin.svg','ninja.svg','boar.svg','extraterrestrial_alien.svg','elephant.svg','horse.svg','pill.svg','princess.svg','mens_symbol.svg','high_voltage_sign.svg','chicken.svg','poop.svg','rainbow_solid.svg','frog_face.svg','koala.svg','anchor.svg','wink.svg','dog_face.svg','bactrian_camel.svg','crescent_moon.svg','hot_beverage.svg','cyclone.svg','satisfied.svg','sun.svg','cactus.svg','spouting_whale.svg','snake_alt.svg','snail.svg','heart.svg'];
	var templates=[];
	
	// template par defaut d'une carte : 8*[x,y,rayon]
	// TODO : définir d'autres templates
	templates.push([[23,76,23],[55,89,11],[88,88,12],[70,51,29],[17,36,17],[10,10,9],[43,15,15],[87,12,12]]);


	/**
	* Connexion d'un client socket.io
	*
	*/
	io.sockets.on('connection', function (client) {

		/**
		*  initialisation des variable d'un joueur
		*/
		var joueur={};
		var partie={};
		var id=client.id;

		console.log("Connexion d'un nouveau joueur id="+id);
		
		initJoueur();


		/************ partie asynchrone ****************/

		/**
		* Création d'une partie
		*/
		client.on('creerPartie', function(data) {


			//TODO: Ajout des conditions nécéssaires ???
			if(partie && partie.id){
				console.log("waw, la partie existe incroyable ! je la vire");
				parties.splice(parties.indexOf(partie),1);
			}
			//le joueur devient master de sa partie
			joueur.master=1;
			joueur.pseudo=data.nomJoueur;
			//ATTENTION la partie contient les id des joueurs!
			//TODO garder un historique des tours???

			// id = id de la partie
			// nom = nom de la partie
			// joueurs = liste des id des joueurs participants
			// tas = carte du tas
			// reponses = réponses éventuelles des joueurs du tas en cours
			//		razé à chaqe nouveau tas
			// attenteReponse : timeout d'attente de la réponse des autres joueurs
			//
			partie={
				id:"p"+Date.now(),
				nom:data.nomPartie,
				joueurs:[id],
				tas:0,
				reponse:0,
			}
			console.log("On créé la partie "+partie.nom+" pour le joueur "+joueur.pseudo+" dont l'id est "+joueur.id);
			// creerDonne qui teste partie.tas ?????
			// TODO : le tas est créé a partir du jeu des joueurs 
			//partie.tas=creerDonne(0);
			parties.push(partie);
			//on stocke l'ID de la partie créée
			//client.partieId=parties.indexOf(partie);
			//client.partieId=partie.id;
			//on s'abonne au groupe correspondant à la partie
			client.join('partie'+partie.id);
			console.log(joueur.pseudo+" créé le nouveau jeu "+partie.nom);
			//liste des joueurs pour cette partie ( forcément seul le joueur créateur !)
			client.emit("jeu",{partie:partie,joueurs:listeJoueurs()});
		});

		/**
		* envoie la liste des parties dispo au client
		*/
		client.on('listerParties', function(data) {
			console.log("listage des parties :"+parties.length);
			var p = [];
			for (var i = parties.length - 1; i >= 0; i--) {
				//teste si la partie est débutée
				if(!parties[i].tas && parties[i].joueurs.length<8){
					p.push({id:parties[i].id,nom:parties[i].nom,nbj:parties[i].joueurs.length});
				}
			}
			//console.log(p);
			client.emit("listeParties",{parties:p});
		});

		/**
		* rejoint une partie
		* renvoie un message d'erreur ou un broadcast de réussite à tous les joueurs
		*
		*/
		client.on('rejoindrePartie', function(data) {
			partie=getPartieById(data.idPartie);
			joueur.pseudo=data.nomJoueur;
			if(!data.idPartie || !partie){
				client.emit("erreur",{message:"Partie non trouvée"});
			}else if(partie.tas!=0){
				client.emit("erreur",{message:"Partie déja débutée"});
			}else if(partie.joueurs.length==8){
				client.emit("erreur",{message:"La partie est pleine"});
			}else if(partie.joueurs.indexOf(id)!=-1){
				client.emit("erreur",{message:"Bien que ce ne soit pas possible, vous participez déjà à cette partie"});
			}else{
				//TODO : tester les place restantes dans la partie
				//TODO : tester si le master est ready
				//TODO : un joueur ne peut pas être 2 fois dans la partie
				//TODO : un joueur ne peux pas jouer 2 parties en meme temps
				//ajoute le joueur à la partie
				partie.joueurs.push(joueur.id);
				//NORMALEMENT (j'ai vérifié!) les objets sont bien pushé et extrait par reférence dans les tableaux !
				//mise à jour de la copie locale????
				//partie=parties[data.idPartie];
				//on s'abonne au groupe correspondant à la partie
				client.join('partie'+partie.id);
				client.emit("jeu",{partie:partie,joueurs:listeJoueurs()});
				//broadcast d'ajout de joueur // sauf pour moi!
				client.broadcast.to('partie'+partie.id).emit("joueur",{joueur:joueur});
				console.log("le joueur "+joueur.pseudo+" rejoint la partie n°"+data.idPartie);
			}
		});


		/**
		* quitte la partie
		* broadcast de l'info à tous les joueurs
		*/
		client.on('quitterPartie', function(data) {
			//retirer le joueur de la partie
			console.log("Liste des joueurs de la partie que l'on veux quitter ("+id+")");
			console.log(partie.joueurs);
			for(var i=0;i<partie.joueurs.length;i++){
				// jid est l'identifiant du joueur, i la position dans la partie
				var jid = partie.joueurs[i]; 
				if(jid==id){
					partie.joueurs.splice(i,1);
					//on retire le joueur du groupe de diffuion
					client.leave('partie'+partie.id);
				}
			}
			console.log("On a enlevé le joueur "+id+" de la partie :");
			console.log(partie.joueurs);
			if(partie.joueurs.length==0){
				//on enleve la partie de la liste des parties
				parties.splice(parties.indexOf(partie),1);
				partie={};
				console.log("Nombre de partie en mémoire :"+parties.length);
			}else{
				//on informe les joueurs que le joueur s'est barré de la partie
				//et on supprime la partie locale
				//partie={};
				client.broadcast.to('partie'+partie.id).emit("deconnexionJoueur",{joueur:joueur});

			}
			//on accuse comme pour une reconnexion ( voir on fait un reload)
			client.emit("accuse",{message:"ok game",id:id});
		});

		/**
		* indique que le joueur est prêt
		*  plusieurs actions en fonctions de l'état des différent joueurs dont
		*  le lancement du jeu
		* 
		*/
		client.on('pret', function(data) {
			//pret est une bascule
			//si le joueur n'est pas pret, il le devient
			if(joueur.ready==0){
				joueur.ready=1;
			}else if(partie.tas==0){ 
				// on est plus prêt du tout :(
				joueur.ready=0;
				client.emit("pret",{joueur:joueur,pret:0});
				client.broadcast.to('partie'+partie.id).emit("pret",{joueur:joueur,pret:0});
				return;
			}else{
				//normalement impossible une fois le bouton 'prêt' enlevé
				//mais on ne sais jamais
				client.emit("erreur",{message:"impossible de quitter une partie débutée."});
				return;
			}
			//si tous les joueurs sont ready on démarre
			var ready=true;
			if(!partie){
				//normalement impossible
				client.emit("erreur",{message:"Partie non trouvée"});
			}else{ 
				if(partie.joueurs.length==1){
					client.emit("erreur",{message:"Attention, vous êtes le premier joueur, dès qu'un autre joueur sera prêt la partie commencera."});
					//on anonce que le joueur est pret
					client.emit("pret",{joueur:joueur,pret:1});
					return;
				}
				var ready=true;
				for(var i=0;i<partie.joueurs.length;i++){
					var j = partie.joueurs[i];
					var joujou=getJoueurById(j);
					console.log("teste si le joueur "+j+" est ready :"+joujou.ready);
					ready=ready&&joujou.ready;
				}
				if(ready){
					//TODO : DOIT! être mutualisé avec la donne plus bas.
					// Sinon risque de recevoir la donne AVANT d'être prêt!!
					//console.log("On envois à tout le monde (dont moi) le fait que je suis prêt");
					//client.emit("pret",{joueur:joueur,pret:1});
					//client.broadcast.to('partie'+partie.id).emit("pret",{joueur:joueur,pret:1});
					/***************************************/
					//distribution initiale pour les joueurs
					/***************************************/
					//TODO : vérifier si l'intégration du client ne pose pas problème.
					var listeDesJoueurs=[]; //pour économiser une double recherche des joueurs et des clients
					for (var i = partie.joueurs.length - 1; i >= 0; i--) {
						var j=partie.joueurs[i];
						var joujou=getJoueurById(j);
						var clicli=getClientById(j);
						joujou.donne=creerDonne();
						listeDesJoueurs.push({joueur:joujou,client:clicli});
					}
					//création du tas
					partie.tas=creerTas();
					//distribution des jeux
					for (var i = listeDesJoueurs.length - 1; i >= 0; i--) {
						var joujou = listeDesJoueurs[i].joueur;
						var clicli = listeDesJoueurs[i].client;
						//On ajoute le joueur pret, cas géré du du premier tour
						clicli.emit("tour",{joueur:joueur,tas:partie.tas,cartes:joujou.donne,idVainqueur:0,joueurs:listeJoueurs()});
					};
					//C'est parti!!!!!!
				}else{
					//on anonce que le joueur est pret
					console.log("On envois à tout le monde le fait que je suis prêt");
					client.emit("pret",{joueur:joueur,pret:1});
					client.broadcast.to('partie'+partie.id).emit("pret",{joueur:joueur,pret:1});
				}
			}
		});

		/**
		* un joueur donne une réponse
		*  test le temps de réaction pour savoir si le joueur a été le plus rapide
		*  on attend 500ms et on valide la réponse du meilleur joueur (sois lui-même soit un autre)
		*  Le test (partie.reponse) permet d'éviter que l'autre joueur valide également sa bonne réponse
		* 
		*/
		client.on('reponse', function(data) {
			console.log("le joueur "+joueur.pseudo+" trouve la carte "+joueur.donne[data.carte].img+" en "+data.rapid+"ms");
			console.log("Sa carte commune était "+joueur.carte);
			//traitement du jeu
			if(joueur.donne[data.carte].img==joueur.carte){
				//on ajoute sa réponse si c'est la plus rapide
				if(partie.reponse){
					//compare le temps de réponse
					if(data.rapid<partie.reponse.rapid){
						partie.reponse={id:joueur.id,rapid:data.rapid};
					}
				}else{
					partie.reponse={id:joueur.id,rapid:data.rapid};
				}
				//On attend 0.5s avant d'envoyer le résultat au vainqueur!
				//pas forcément le joueur courant donc, vérifier si la réponse n'a pas déja été envoyé!
				setTimeout(function(){
					if(partie.reponse){
						var joujou = getJoueurById(partie.reponse.id);
						console.log("Le joueur le plus rapide est "+joujou.pseudo);
						//RAZ de la meilleure réponses
						partie.reponse=0;
						//on augmente le score
						joujou.score++;
						//nouveau jeu pour le joueur
						//normalement il prends le tas comme nouveau jeu
						joujou.donne=partie.tas;
						//console.log("nouveau jeu du joueur avant le nouveau tas");
						//nouveau tas
						partie.tas=creerTas();
						//console.log("nouveau jeu du joueur APRES le nouveau tas");
						//on distribue aux joueurs
						for (var i = partie.joueurs.length - 1; i >= 0; i--) {
							var j=partie.joueurs[i];
							var autrejoujou=getJoueurById(j);
							var clicli=getClientById(j);
							clicli.emit("tour",{tas:partie.tas,cartes:autrejoujou.donne,idVainqueur:joujou.id,joueurs:listeJoueurs()});
						}
					}
				},500);
			}else{
				//trompé
				client.emit("mauvaisereponse",{});
			}
		});


		/**
		* debug des variables de jeu
		* envoie au joueur
		*/
		client.on('debug', function() {
			client.emit("debug",{joueur:joueur,partie:partie,joueurs:joueurs,parties:parties});
		});


		/**
		* debug : reset du jeu
		* broadcast à tous les joueurs
		*/
		client.on('reset', function() {

			console.log("*****************************************");
			console.log("            TOTAL RESET  ");
			console.log("*****************************************");

			var partieId=partie.id;

			//megamenage
			joueurs=[];
			clients=[];
			parties=[];

			joueur={};
			partie={truc:999};// rustine de test

			//il y a au moins le joueur ! !! pas cohérent avec le 'accuse'
			//joueurs[id-1]=joueur;
			//clients[id-1]=client;

			client.emit("reload",{});
			client.broadcast.to('partie'+partieId).emit("reload",{});

		});


		/**
		* deconnexion d'un joueur
		*  Il faut traiter le cas du créateur de la partie
		*/
		client.on('disconnect', function() {
			console.log("deconnexion du joueur "+id);

			console.log(partie);

			try{

				//si c'est le master on vire la partie sinon juste le joueur
				if(partie && partie.joueurs && partie.joueurs.length>0 && partie.joueurs[0]==id){

					client.broadcast.to('partie'+partie.id).emit("fin",{partie:partie});

					//desaboner les joueurs au groupe de diffusion

					
					
					//TODO //vider parties
					parties.splice(parties.indexOf(partie),1);
					partie={};

				}else{
					//Annonce la déconnexion du joueur
					client.broadcast.to('partie'+partie.id).emit("deconnexionJoueur",{joueur:joueur});
				}

				console.log("je vais essayer de virer le joueur : "+joueur.id);
				console.log(joueurs);

				joueurs.splice(joueurs.indexOf(joueur),1);
				joueur={};

				console.log(joueurs);
				console.log("Fin");

				clients.splice(clients.indexOf(client),1);
				client={};

				//TODO, il faut bien voir le comportement en cas de reconnexion ici !!!!!

			}catch(e){
				console.log("Interception d'exception dans la déconnexion , Partie : ");
				console.log(partie);
				console.log(e);
				//destruction de l'objet
				for (prop in this){prop=null;}
			}

			//console.log(parties);
			//console.log(joueurs);
			//client.broadcast.emit("joueur",{num:-id,message:""});

		});


/***************** Fonctions ****************************************************************************/
		

		/**
		* Initialisation d'un joueur
		* 
		*/
		function initJoueur(){
			joueur ={id:id,
					master:0,
					pseudo:'',
					ready:0,
					donne:0,
					carte:0,
					score:0};

			//!!!! impossible d'ajouter un attribut dirctement à client, ca plante
			//le socket
			//client.id=id;
			//client.prototype.id=id;
			var ij = joueurs.indexOf(joueur);
			if(ij==-1){
				joueurs.push(joueur);
			}else{
				//inutile normalement
				joueurs[ij]=joueur;
			}
			
			var ic = clients.indexOf(client);
			if(ic==-1){
				clients.push(client);
			}else{
				//inutile normalement
				clients[ic]=client;
			}


			//on informe le client et on donne les images en preload
			client.emit("accuse",{message:"ok game",id:id,images:images});

		};

		/**
		* création de la liste des joueurs
		* @return {id , pseudo , score}
		*/
		function listeJoueurs(){
		//créé la liste des joueurs et de leur pseudo
			var listeDesJoueurs=[];
			for (var i=0;i<partie.joueurs.length;i++) {
				var jid = partie.joueurs[i];
				var joujou = getJoueurById(jid);

				//console.log("j'ajoute le joueur "+jid+" à la liste des joueurs");
				listeDesJoueurs.push({id:joujou.id,pseudo:joujou.pseudo,score:joujou.score,ready:joujou.ready});
			}

			return listeDesJoueurs;
		};

		/**
		* récupération d'un joueur par son Id
		* 
		* @return joueur
		*/
		function getJoueurById(jid){
			for (var i = joueurs.length - 1; i >= 0; i--) {
				var joujou =joueurs[i];
				if(joujou.id==jid){
					return joujou;
				}
			}
			return null;
		}
		/**
		* récupération d'un client par son Id
		* 
		* @return client
		*/
		function getClientById(cid){
			for (var i = clients.length - 1; i >= 0; i--) {
				var clicli =clients[i];
				if(clicli.id==cid){
					return clicli;
				}
			}
			return null;
		}
		/**
		* récupération d'une partie par son Id
		* 
		* @return partie
		*/
		function getPartieById(pid){
			for (var i = parties.length - 1; i >= 0; i--) {
				var parpar =parties[i];
				if(parpar.id==pid){
					return parpar;
				}
			}
			return null;
		}
		/**
		* création d'une main pour un joueur
		*   la nouvelle main doit tenir compte des jeux des autres joueurs, seul le vainqueur prend le nouveau tas !!! 
		*   il faut donc générer la carte et le tas en fonction du jeu des joueurs
		* @return nouvelle carte
		*/
		function creerDonne(){

			var jeu=[];

			while(jeu.length<8){
				var n = (Math.random()*images.length) | 0;
				var img = images[n];
				var ok=true;
				//teste les carte précédentes
				for(var j=0;j<jeu.length;j++){
					if(jeu[j]==img){ok=false;break;}
				}
				if(ok){jeu.push(img);}
			}

			//melange des 8 valeurs
			//TODO trouver un algo certainement plus efficace
			//console.log(jeu);

			var donne=[];

			
			for (var i=0;i<8;i++){
				var j=(Math.random()*8-i) | 0;
					//on swap
				var tmp = jeu[i];
				jeu[i]=jeu[i+j];
				jeu[i+j]=tmp;
				//on rempli la donne
				//TODO si on le fait ici on a de nombreux doublon???
				// comprend pas p?
			}	
			

			// du coup re-boucle
			for (var i=0;i<8;i++){
				donne.push(
					{img:jeu[i],
					 x:templates[0][i][0],
					 y:templates[0][i][1],
					 r:templates[0][i][2],
					 orientation:((Math.random()*360) | 0)}
				);
			}

			return donne;
		};

		/**
		* création d'une nouvelle carte du tas
		* @return nouvelle carte
		*/
		function creerTas(){

			//prends des cartes dans le jeu des joueurs
			//console.log("Dans creerTas, la partie vaut : ");
			//console.log(partie);

			var jeu=[];
			var tas=[];
			var listeDesJoueurs=[];
			for (var i=partie.joueurs.length-1;i>=0;i--) {
				listeDesJoueurs.push(getJoueurById(partie.joueurs[i]));
			}

			console.log("-----------------------");
			console.log("On va chercher les cartes du tas");
			//trouve une carte pour chaque joueurs
			for (var i=listeDesJoueurs.length-1;i>=0;i--) {
				var joujou=listeDesJoueurs[i];
				console.log("les cartes du joueur "+joujou.id);
				console.log(joujou.donne);
				
				while(true){
					//console.log("tirage carte pour "+joujou.id);
					//une carte au hasard dans le jeu du joueur
					var n=(Math.random()*8) | 0;		
					var img=joujou.donne[n].img;
					var ok=true;
					//on vérifie qu'elle n'est pas déjà dans le jeu
					for (var j = jeu.length - 1; j >= 0; j--) {
						if(jeu[j]==img){ok=false;break;}
					}
					console.log("la carte "+img+" n'est pas déja pas dans le jeu");
					//ni dans le jeu des autres joueurs(sinon doublons pour eux !)
					for (var j=listeDesJoueurs.length-1;j>=0;j--) {
						if(i==j)continue;//on evite de regarder dans son propre jeu
						var iouiou=listeDesJoueurs[j];
						for (var k=iouiou.donne.length-1;k>=0;k--) {
							if(iouiou.donne[k].img==img){ok=false;break;}
						}
						console.log("la carte "+img+" n'est déja pas dans le jeu de "+iouiou.id);
						if(!ok)break;
					}

					if(ok){
						jeu.push(img);
						//mise à jour de la carte gagnante du joueur
						console.log("Carte commune du joueur "+joujou.id+" : "+img);
						joujou.carte=img;
						break;
					}



				}
			}

			//on comble avec des cartes qui ne sont ni sur la carte, ni dans le jeu des joueurs
			while(jeu.length<8){

				//console.log("tirage carte pour combler");

				var n = (Math.random()*images.length) | 0;
				var img = images[n];
				var ok=true;

				//on vérifie qu'elle n'est pas déjà dans le jeu
				for (var j = jeu.length - 1; j >= 0; j--) {
					if(jeu[j]==img){ok=false;break;}
				}
				//ni dans le jeu des autres joueurs déja servis (sinon doublons pour eux !)
				for (var j=listeDesJoueurs.length-1;j>i;j--) {
					var iouiou=listeDesJoueurs[j];
					for (var k=iouiou.donne.length-1;k>=0;k--) {
						if(iouiou.donne[k].img==img){ok=false;break;}
					}
					if(!ok)break;
				}
				if(ok){
					//console.log("ajout d'une nouvelle carte : "+img);
					jeu.push(img);
				}
			}

			//melange des 8 valeurs
			//TODO trouver un algo certainement plus efficace
			//console.log("le jeu complet avant mélangeage pour le Tas :");
			//console.log(jeu);

			for (var i=0;i<8;i++){
				var j=(Math.random()*8-i) | 0;
					//on swap
				var tmp = jeu[i];
				jeu[i]=jeu[i+j];
				jeu[i+j]=tmp;
				//on rempli la donne
				//TODO si on le fait ici on a de nombreux doublon???
				// comprend pas p?
			}	
			
			// du coup re-boucle
			for (var i=0;i<8;i++){
				tas.push(
					{img:jeu[i],
					 x:templates[0][i][0],
					 y:templates[0][i][1],
					 r:templates[0][i][2],
					 orientation:((Math.random()*360) | 0)}
				);
			}
			return tas;
		};

	});
})();
