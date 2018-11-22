var Hammer = require("hammerjs");
var HttpUtils = require("../util/Static").http;
var Static = require("../util/Static");
var DomUtils = Static.dom;
var transition = require("css-transition");
var promise = require("promise-polyfill");

function AjaxNav( options ) {

	var api = {
		fadeOut: fadeOut,
		fadeIn: fadeIn,
		load: load,
		destroy: destroy
	};

	var fadeingPromises = [];
	var hammerInstances = [];

	var history = [];

	function initialize() {

		if ( !(options.selector && Static.isIterable(options.items)) ) {
			return;
		}

		hammerInstances = Static.map(options.items, function addEventListener(element) {
			if ( element instanceof Element ) {
				element.addEventListener("click", preventDefault);
				return new Hammer(element).on("tap", onItemClick);
			}
		});

		pushCurrentLocationToHistory();

		if ( options.bindHistory ) {
			window.addEventListener("popstate", onPopState);
		}
	}

	function destroy() {

		if ( options.bindHistory ) {
			window.removeEventListener("popstate", onPopState);
		}
		Static.each(hammerInstances, function (hammer) {
			if ( hammer ) {
				hammer.destroy();
			}
		});
	}

	function onItemClick(event) {
		if ( event.target.classList.contains("nav-button-more")) {
			return; // thanks hammerJs or not being able to stop propagation
		}
		var anchor = DomUtils.closest(event.target, "a");
		if ( anchor && anchor.href ) {

			if ( !Static.http.isSamePath(anchor.href, document.location.href) ) {

				load( anchor.href, true, event.target );
			}
		}
	}

	function load(href, pushState, clickTarget ) {

		onBeforeLoad(href);

		HttpUtils.requestDom(href, function (dom) {
			promise.all(fadeingPromises).then(function () {
				onDocumentLoad( dom, href, pushState, clickTarget );
			}).catch(function (error) {
				console.log(error);
			});
		}, onDocumentLoadError, {});
	}


	function onDocumentLoad( dom, href, pushState, clickTarget ) {

		if ( !(dom instanceof Document) ) {
			document.location.href = href;
			return;
		}

		var bodyCurrent = document.querySelector(options.selector);
		if ( !bodyCurrent ) {

			return console.error("cannot find current body");
		}
		var hrefCurrent = history[history.length - 1].href;

		var bodyNew = dom.querySelector(options.selector);
		var parent = bodyCurrent.parentNode;

		if ( !bodyNew || !parent ) {
			document.location.href = href;
			return;
		}

		bodyNew.style.display = "none";

		onBeforeChange( dom, href );

		parent.insertBefore(bodyNew, bodyCurrent);
		parent.removeChild(bodyCurrent);

		bodyNew.style.display = "";

		onAfterChange({
			type: "onAfterDomChange",
			target: clickTarget,
			oldUrl: hrefCurrent,
			newUrl: href,
			oldDom: bodyCurrent,
			newDom: bodyNew
		});

		if ( pushState ) {
			window.history.pushState(null, null, href);
		}

	}

	function onBeforeChange( dom ) {

		if ( options.fadeImages ) {
			Static.each(dom.querySelectorAll("img"), function (element) {
				element.style.opacity = 0;
				element.addEventListener("load", onImageLoad);
			});
		}

		if ( typeof options.onBeforeChange == "function" ) {
			options.onBeforeChange( dom );
		}
	}

	function onAfterChange( event ) {

		fadeIn();

		if ( typeof options.onAfterChange == "function" ) {
			options.onAfterChange( event );
		}
	}

	function onBeforeLoad( href ) {

		fadeOut();

		if ( typeof options.onBeforeLoad == "function" ) {
			options.onBeforeLoad(href);
		}
	}

	function fadeOut() {

		var fadeProps = options.fadeOutProps || options.fadeProps;
		if ( fadeProps ) {
			for (var selector in fadeProps) {

				if (fadeProps.hasOwnProperty(selector)) {

					var propsFrom = fadeProps[selector][0];
					var propsTo = fadeProps[selector][1];
					var duration = fadeProps[selector].duration;

					fadeingPromises = fadeingPromises.concat(Static.map(document.querySelectorAll(selector), function (element) {

						Static.dom.style(element, propsFrom);
						return transition(element, propsTo, duration);
					}));
				}
			}
		}

	}

	function fadeIn() {

		var fadeProps = options.fadeInProps || options.fadeProps;
		if ( fadeProps ) {
			for (var selector in fadeProps) {
				if (fadeProps.hasOwnProperty(selector)) {

					var propsFrom = (fadeProps == options.fadeInProps) ? fadeProps[selector][0] : fadeProps[selector][1];
					var propsTo = (fadeProps == options.fadeInProps) ? fadeProps[selector][1] : fadeProps[selector][0];
					var duration = fadeProps[selector].duration;

					Static.each(document.querySelectorAll(selector), function (element) {

						Static.dom.style(element, propsFrom);
						transition(element, propsTo, duration);
					});
				}
			}
		}
	}

	function onImageLoad(event) {

		var element = event.target;
		var parent = element.parentNode;

		if ( element.offsetHeight == 0 ) {

			// Safari render fix
			if ( navigator.userAgent.indexOf("Safari") != -1 ) {
				parent.innerHTML = parent.innerHTML;
			}
			Static.each(parent.childNodes, function (item) {
				if ( item.tagName == "IMG" ) {
					element = item;
				}
			});
		}
		transition(element, { opacity: 1 }, 250);
	}

	function onDocumentLoadError() {

		fadeIn();
	}

	function preventDefault(event) {
		event.preventDefault();
	}

	function pushCurrentLocationToHistory() {
		history.push({
			pathname: document.location.pathname,
			href: document.location.href
		});
	}
	function onPopState(event) {

		if ( history[history.length - 1].pathname != document.location.pathname ) {

			pushCurrentLocationToHistory();
			fadeOut();
			load( document.location.pathname );
		}
	}

	return initialize(), api;
}
if ( typeof module == "object" ) {
	module.exports = AjaxNav;
}

