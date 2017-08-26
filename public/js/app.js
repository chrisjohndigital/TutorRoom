/*

  NOTE: PeerConnectionView based on video_call_with_chat_and_file_sharing.html by Rob Manson
        See https://github.com/buildar/getting_started_with_webrtc for more info
        
  The MIT License
  
  Copyright (c) 2013 Rob Manson, http://buildAR.com. All rights reserved.
  
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:
  
  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*/
var ModelItem = Backbone.Model.extend({
    defaults: {
		cameraViewReference: null,
		supportsWebRTC: false,
		supportsMediaRecorderAPI: false,
		localStream: null,
        remoteStream: null,
		appHeight: 800,
		cameraMaxWidth: 1280,
		cameraMaxHeight: 720,
        cameraMinWidth: 640,
		cameraMinHeight: 360,
		includeAudio: false,
		cameraScaleComplete: false,
		prepRecording: false,
		publishRecording: false,
		errorMsgArray: ['<h1>WebRTC required - Sorry, unable to connect to camera</h1><p>Please ensure no other devices are using the camera and refresh the browser.</p><p><a href="https://developer.mozilla.org/en-US/docs/Web/Guide/API/WebRTC">More information about WebRTC</a></p>', 'Sorry, the recorder has stopped unexpectedly'],
		mime: 'video/webm',
        ext1: '.webm',
		fileAddress: null,
		fileLoad: false,
		scaleAssets: false,
        socketAddress: 'http://localhost:8080', 
        token: null,
		stun_server: 'stun.l.google.com:19302',
        createOffer: false,
        offer: null,
        receiveOffer: null,
        ice: false,
        iceCandidate: null,
        receiveIce: false,
        receiveIceCandidate: null,
        toggleRemote: true,
        supportsFileAPI: false,
		fileShareAddress: null,
        fileShareMimeType: null,
        fileShareExtension: null,
		fileShareLoad: false,
        storedBlob: null,
        receivedBlobArray: new Array(),
		receivedBlob: null,
        fileSlice: 1024
    },
	initialize: function(){
		_.bindAll(this, 'featureSupport');
		this.featureSupport();
	},
	featureSupport: function(){
        if (navigator.mediaDevices) {
            if (navigator.mediaDevices.getUserMedia) {
			 this.set ('supportsWebRTC', true);
		  }
        }
		if (window.MediaRecorder && window.Blob && window.FileReader) {
			this.set ('supportsMediaRecorderAPI',  true);
		}
        if (window.File && window.FileReader && window.FileList && window.Blob) {
			this.set ('supportsFileAPI', true);
		}
	}
});
var SocketView = Backbone.View.extend({
	model: null,
    socket: null,
   	initialize: function(){
        _.bindAll(this, 'render', 'setToken', 'sendOffer', 'sendIce');
        this.model.bind('change:cameraScaleComplete', this.render, this);
   	},
	render: function(){
        this.model.bind('change:offer', this.sendOffer, this);
        this.model.bind('change:ice', this.sendIce, this);
        this.model.bind('change:storedBlob', this.fileshare, this);
		this.socket=io.connect(this.model.get('socketAddress'));
        var viewReference=this;
        this.socket.on('handshake', function (data) {
            console.log('Client handshake callback: ' + data);
            viewReference.setToken();
        });
        this.socket.on('token-received', function (data) {
            console.log('Client token-received callback: ' + data);
            viewReference.model.set('token', data);
        });
        this.socket.on('token-users', function (data) {
            console.log('Client token-users callback: ' + data);
            viewReference.model.set('createOffer', true);
        });
        this.socket.on('offer', function (data) {
            console.log('Client offer callback: ' + data);
            viewReference.model.set('receiveOffer', data);
        });
        this.socket.on('ice', function (data) {
            console.log('Client ice callback: ' + data);
            viewReference.model.set('receiveIceCandidate', data);
            viewReference.model.set('receiveIce', !viewReference.model.get('receiveIce'));
        });
        this.socket.on('fileshare', function (data) {
            console.log('Client fileshare callback');
            var receivedBlobArray = viewReference.model.get('receivedBlobArray');
            receivedBlobArray[receivedBlobArray.length] = data;
            viewReference.model.set ('receivedBlobArray', receivedBlobArray);
        });
        this.socket.on('fileshare-complete', function (data) {
            console.log('Client fileshare complete callback');
            viewReference.model.set ('receivedExtension', data);
            viewReference.model.set ('receivedBlob', viewReference.model.get('receivedBlobArray').join(''));
            viewReference.model.set('receivedBlobArray', new Array());
        });
	},
    setToken: function(){
        if (this.model.get('token')==null) {
            if (document.location.hash=='') {
                var token = Date.now()+'-'+Math.round(Math.random()*10000);
                document.location.hash=token;
                this.socket.emit('setToken', token);        
            } else {
                var token = ((String(document.location.hash)).split('#'))[1];
                this.socket.emit('setToken', token);
            }
        }
    },
    sendOffer: function(){
        this.socket.emit('offer', this.model.get('offer'));  
    },
    sendIce: function(){
        this.socket.emit('ice', this.model.get('iceCandidate'));  
    },
    fileshare: function(){
        var fileParts = 0;
        if ((((this.model.get('storedBlob')).length)/this.model.get('fileSlice')) % 1 > 0) {
            fileParts = Math.round((((this.model.get('storedBlob')).length)/this.model.get('fileSlice')))+1;
        } else {
            fileParts = (((this.model.get('storedBlob')).length)/this.model.get('fileSlice'));
        }
        console.log ('Client: emit fileshare, number of parts: ' + fileParts);
        for (var i = 0; i < fileParts; i++) {            
            this.socket.emit('fileshare', this.model.get('storedBlob').slice(i*this.model.get('fileSlice'), ((i*this.model.get('fileSlice'))+this.model.get('fileSlice'))));
        }
        this.socket.emit('fileshare-complete', this.model.get('fileShareExtension'));
    }
});
var PeerConnectionView = Backbone.View.extend({
	model: null,
    peer_connection: null,
   	initialize: function(){
        _.bindAll(this, 'render', 'createOffer', 'receiveOffer', 'receiveIce', 'log_error');
        this.model.bind('change:token', this.render, this);
   	},
	render: function(){
        console.log ('Rendering: PeerConnectionView');
        this.model.bind('change:createOffer', this.createOffer, this);
        this.model.bind('change:receiveOffer', this.receiveOffer, this);
        this.model.bind('change:receiveIce', this.receiveIce, this);
        var viewReference = this;
		console.log ('Stun server: ' + this.model.get ('stun_server'));
        var rtc_peer_connection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
        this.peer_connection = new rtc_peer_connection({ 
			'iceServers': [
      			{ 'urls': 'stun:'+this.model.get ('stun_server') },
    		]
  		});
        this.peer_connection.onicecandidate = function (event) {
			console.log ('peer_connection.onicecandidate');
            if (event.candidate) {
                viewReference.model.set('iceCandidate', event.candidate);
                viewReference.model.set('ice', !viewReference.model.get('ice'));
            }
  		};
        this.peer_connection.onaddstream = function (event) {
            if (event.stream) {
                console.log ('peer_connection.onaddstream');
                viewReference.model.set ('remoteStream', event.stream);
            }
	  	};
        this.peer_connection.addStream(this.model.get('localStream'));
	},
    createOffer: function() {
        console.log('PeerConnectionView: creating offer');
        var viewReference = this;
        this.peer_connection.createOffer(
            function (description) {
               viewReference.peer_connection.setLocalDescription(
                   description, 
                   function () {
                       viewReference.model.set('offer', description);
                   },
                   viewReference.log_error
               ); 
            },
            viewReference.log_error
		);
    },
    receiveOffer: function() {
        console.log('PeerConnectionView: offer received');
        var viewReference = this;
        var sessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
        this.peer_connection.setRemoteDescription(
            new sessionDescription(this.model.get('receiveOffer')), 
            function () {
                if (viewReference.peer_connection.remoteDescription.type == 'offer') {
                    viewReference.peer_connection.createAnswer(
                        function (description) {
                            viewReference.peer_connection.setLocalDescription(
                                description, 
                                function () {
                                    viewReference.model.set('offer', description);
                                },
                                viewReference.log_error
                            ); 
                        },
                        viewReference.log_error  
			         );
                }
      	     },
            viewReference.log_error  
        );
    },
    receiveIce: function() {
        var rtc_ice_candidate = window.RTCIceCandidate || window.mozRTCIceCandidate;        
        this.peer_connection.addIceCandidate(
      		new rtc_ice_candidate(this.model.get('receiveIceCandidate'))
        );
    },
    log_error: function(error) {
		console.log ('Error: ' + error);
	}
});
var PlaybackView = Backbone.View.extend({    
	el: null,
	model: null,
   	initialize: function(){
  		_.bindAll(this, 'loadFile', 'validateDOM', 'prepRecording');
		this.model.bind('change:fileLoad', this.loadFile, this);
		this.model.bind('change:prepRecording', this.prepRecording, this);
   	},
	loadFile: function(){
		if (this.model.get('fileAddress')!=null && this.validateDOM()==true) {
			var viewReference = this;
			var reader = new FileReader();
			reader.onloadend = (function(event) {
				if (event.target.readyState == FileReader.DONE) {
					$(viewReference.el).attr('src', event.target.result);
					$(viewReference.el).attr('width', viewReference.model.get ('cameraMaxWidth'));
					$(viewReference.el).attr('width', viewReference.model.get ('cameraMaxHeight'));
					$(viewReference.el).css ('display', 'block');
					viewReference.model.set ('scaleAssets', !viewReference.model.get ('scaleAssets'));
				}
				reader = null;
			});//onloadend
			reader.readAsDataURL(this.model.get('fileAddress'));			
		}
	},
	validateDOM: function () {
		if ($(this.el).length > 0) {
			return true;
		} else {
			return false;
		}
	},
	prepRecording: function() {
		$(this.el).css('display', 'none');
	}
});
var RemoteView = Backbone.View.extend({
	el: null,
    model: null,
    initialize: function(){
    	_.bindAll(this, 'render', 'toggleRemote', 'resetRemote', 'validateDOM');
		this.model.bind('change:remoteStream',this.render,this);
    },
	render: function(){
        if (this.validateDOM()==true) {
            console.log ('Attaching incoming video stream to target');
            this.model.bind('change:toggleRemote',this.toggleRemote,this);
            this.model.bind('change:fileLoad', this.resetRemote, this);
            var remoteStream = this.model.get('remoteStream');
            var target = this.el;
            target.src = window.URL.createObjectURL(remoteStream);
            $(this.el).css('display', 'block');
            this.toggleRemote();
        }
	},
    toggleRemote: function() {
        if (this.model.get('toggleRemote')==true) {
            $(this.el).addClass('remote');
        } else {
            $(this.el).removeClass('remote');
        }
    },
    resetRemote: function() {
        this.model.set('toggleRemote', true);
    },
    validateDOM: function () {
		if ($(this.el).length >=1) {
			return true;
		} else {
			return false;
		}
	}
});
var AddressBarView = Backbone.View.extend({
	el: null,
    model: null,
    initialize: function(){
    	_.bindAll(this, 'render', 'validateDOM');
		this.model.bind('change:token', this.render, this);
    },
	render: function(){
        if (this.validateDOM()==true) {
            $(this.el).html('<p><a href="mailto:'+window.location+'">'+window.location+'</a></p>');
            $(this.el).css('display', 'block');
        }
	},
    validateDOM: function () {
		if ($(this.el).length >=1) {
			return true;
		} else {
			return false;
		}
	}
});
var MediaRecorderView = Backbone.View.extend({    
	model: null,
	recorder: null,
    blobArray: [],
	recordingStopped: false,
	recordingProcessed: false,
   	initialize: function(){
  		_.bindAll(this, 'render', 'publishRecording', 'recordStart', 'recordStop', 'readBlob');
		this.model.bind('change:cameraScaleComplete', this.render, this);
   	},
	render: function() {
		this.model.bind('change:publishRecording',this.publishRecording,this);
	},
	publishRecording: function(){
		if (this.model.get ('publishRecording')==true) {
			this.recordStart();
		} else {
			this.recordStop();
		}
	},
	recordStart: function(){
        this.blobArray = [];
		this.recordingStopped = false;
		this.recordingProcessed = false;
		if (this.model.get('localStream')!=null) {
			this.recorder = new window.MediaRecorder(this.model.get('localStream'));
			var viewReference = this;
		  	this.recorder.ondataavailable = function(event) {
                console.log ('ondataavailable');
				if (event.data.size > 0) {
					viewReference.blobArray.push(event.data);
				}
				if (viewReference.recordingStopped==true && viewReference.recorder.state=="inactive" && viewReference.model.get ('publishRecording')==false && viewReference.blobArray.length > 0 && viewReference.recordingProcessed==false) {
					//ondataavailable event fired after the onstop event
					var blob = new window.Blob(viewReference.blobArray, {
					  type: viewReference.model.get('mime')
				  	});
					viewReference.readBlob(blob);
				}
    		};
			this.recorder.onstop = function() {
                console.log ('onstop');
        		viewReference.recorder = null;
                if (viewReference.model.get ('publishRecording')==true) {
                    alert (viewReference.model.get('errorMsgArray')[1]);
                } else if (viewReference.blobArray.length > 0) {
					var blob = new window.Blob(viewReference.blobArray, {
					  type: viewReference.model.get('mime')
				  	});
					viewReference.readBlob(blob);
					viewReference.recordingProcessed=true;
				}
				viewReference.recordingStopped=true;
    		};
    		this.recorder.start();
		} else {
			//Add error handling
		}
	},
	recordStop: function(){
		this.recorder.stop();
	},
	readBlob: function(blob) {
		this.model.set('fileAddress', blob);
		this.model.set('fileLoad', !this.model.get('fileLoad'));			
	}
});
var MenuView = Backbone.View.extend({    
	el: null,
   	initialize: function(){
		_.bindAll(this, 'render', 'validateDOM', 'handleCameraPublishing', 'prepRecording', 'prepPlayback', 'applyStyles');
		this.model.bind('change:cameraScaleComplete', this.render, this);
  	},
	render: function(){
		if (this.validateDOM()==true) {
			this.model.bind('change:publishRecording', this.handleCameraPublishing, this);
			this.model.bind('change:prepRecording', this.prepRecording, this);
			$(this.$('button')[0]).css('display', 'inline-block');
		}
	},
	validateDOM: function () {
		if ($(this.el).length > 0 && this.model.get('supportsMediaRecorderAPI')==true && this.model.get('supportsWebRTC')==true) {
            $(this.el).css('display', 'block')
			return true;
		} else {
			return false;
		}
	},
	handleCameraPublishing: function(){
		if (this.model.get ('publishRecording')==false) {			
			this.prepPlayback();
			this.removeStyles();
		} else {
			this.prepRecording();
			this.applyStyles();
		}
	},
	prepPlayback: function() {
		$(this.$('button')[0]).css('display', 'none');
		$(this.$('button')[1]).css('display', 'inline-block');
		$(this.$('button')[2]).css('display', 'inline-block');
	},
	prepRecording: function() {
		$(this.$('button')[0]).css('display', 'inline-block');
		$(this.$('button')[1]).css('display', 'none');
		$(this.$('button')[2]).css('display', 'none');
	},
	applyStyles: function() {
		$(this.$('button')[0]).addClass('btn-pulse');
	},
	removeStyles: function() {
		$(this.$('button')[0]).removeClass('btn-pulse');
	}
});
var FileDropView = Backbone.View.extend({
	el: null,
    model: null,
    initialize: function(){
    	_.bindAll(this, 'render', 'displayFile', 'validateDOM');
		this.model.bind('change:remoteStream', this.render, this);
    },
	render: function(){
        if (this.validateDOM()==true) {
            this.model.bind('change:receivedBlob', this.displayFile, this);
            $(this.el).css('display', 'block');
            $(this.el).addClass('file-ready');
        }
	},
    displayFile: function(){
        console.log ('FileDropView: displayFile');
        var file = this.model.get('receivedBlob');
        $(this.el).html('<p><a download="'+(String((String((new Date()).getTime())) + (String(Math.floor((Math.random() * 100000) + 1))))) + this.model.get('receivedExtension')+'" href="'+file+'">Download file</a></p>');
        if ($(this.el).hasClass('file-ready')==true) {
            $(this.el).removeClass('file-ready');
        }
        if ($(this.el).hasClass('file-received')==false) {
            $(this.el).addClass('file-received');
        }
	},
    validateDOM: function () {
		if ($(this.el).length >=1 && this.model.get ('supportsFileAPI')==true) {
			return true;
		} else {
			return false;
		}
	}
});
var FileShareLoaderView = Backbone.View.extend({
	model: null,
   	initialize: function(){
  		_.bindAll(this, 'loadFile');
		this.model.bind('change:fileShareLoad', this.loadFile, this);
   	},
	loadFile: function(){
		console.log ('loadFile');
        var viewReference = this;
		var reader = new FileReader();
        reader.onloadend = (function(event) {
            console.log ('onloadend: ' + event.target.readyState);
			if (event.target.readyState == FileReader.DONE) {
                var file = event.target.result;
                viewReference.model.set ('storedBlob', file);
			}
			reader = null;
        });
        reader.readAsDataURL(this.model.get('fileShareAddress'));		
	}
});
var ThumbnailView = Backbone.View.extend({
	el: null,
    model: null,
    initialize: function(){
    	_.bindAll(this, 'render', 'validateDOM');
		this.model.bind('change:fileAddress', this.render, this);
    },
	render: function(){
        if (this.validateDOM()==true) {
            if ($(this.el).css('display')=='none') {
                $(this.el).css('display', 'block');
            }
            var blob = this.model.get('fileAddress');
            var d = new Date();
            var n = d.getTime(); 
		    blob.lastModifiedDate = d;
            blob.name = (String(n)) + (String(Math.floor((Math.random() * 100000) + 1)) +this.model.get('ext1'));
		    var blobURL = URL.createObjectURL(blob);
            $(this.el).find('a').attr('href', blobURL);
            $(this.el).find('a').attr('download', blob.name);
            var cameraViewReference = this.model.get('cameraViewReference');
            var video = cameraViewReference.target;
            if ($(video).length > 0) {
                var canvas = this.$('canvas')[0];
                if ($(canvas).length > 0) {
                    canvas.getContext('2d').drawImage(video, 0, 0, (this.model.get('cameraMaxWidth'))/8, (this.model.get('cameraMaxHeight'))/8);
                }
            }
        }
	},
    validateDOM: function () {
		if ($(this.el).length >=1) {
			return true;
		} else {
			return false;
		}
	}
});
var CameraView = Backbone.View.extend({    
	el: null,
    target: null,
   	initialize: function(){
		_.bindAll(this, 'render', 'validateDOM', 'supportsWebRTC', 'readyFunction', 'handleCameraPublishing', 'handleCameraPrep', 'toggleRemote');
  	},
	render: function(){
		if (this.validateDOM()==true) {
            this.model.bind('change:toggleRemote',this.toggleRemote,this);
			var viewReference = this;
			$(this.el).on('canplay', this.readyFunction);
            this.target = this.el;
            var video_constraints = {
				width: { min: this.model.get ('cameraMinWidth'), ideal: this.model.get ('cameraMaxWidth'), max: this.model.get ('cameraMaxWidth') },
        		height: { min: this.model.get ('cameraMinHeight'), ideal: this.model.get ('cameraMaxHeight'), max: this.model.get ('cameraMaxHeight') }
			};
            var device = navigator.mediaDevices.getUserMedia({audio: this.model.get('includeAudio'), video: video_constraints});
            device.then(function(mediaStream) {
                //$(viewReference.el).attr('src', window.URL.createObjectURL(mediaStream));//Deprecated
                (viewReference.el).srcObject = mediaStream;
                //document.getElementById('camera').srcObject = mediaStream; //Alternative                
				viewReference.model.set({localStream: mediaStream });
            });
            device.catch(function(err) {
                alert (err);
            });
		} else {
			$(this.el).parent().html(this.model.get('errorMsgArray')[0]);
		}
	},
	validateDOM: function () {
		if ($(this.el).length > 0 && this.supportsWebRTC()==true) {
			return true;
		} else {
			return false;
		}
	},
	supportsWebRTC: function () {
		if (this.model.get('supportsWebRTC')) {
			return true;
		} else {
			return false;
		}
	},
	readyFunction: function(event){
		if (this.model.get ('cameraScaleComplete')==false) {
			$(this.el).attr('width', this.model.get ('cameraMaxWidth'));
			$(this.el).attr('height', this.model.get ('cameraMaxHeight'));
			this.model.bind('change:publishRecording', this.handleCameraPublishing, this);
			this.model.bind('change:prepRecording', this.handleCameraPrep, this);
			this.model.set ('cameraScaleComplete', true);
			this.model.set ('scaleAssets', !this.model.get ('scaleAssets'));
		}
	},
	handleCameraPublishing: function(){
		if (this.model.get ('publishRecording')==false) {
			$(this.el).css('display', 'none');
		} else {
			$(this.el).css('display', 'block');
		}
	},
	handleCameraPrep: function() {
		$(this.el).css('display', 'block');
	},
    toggleRemote: function (){
        if (this.model.get('toggleRemote')==false) {
            $(this.el).addClass('remote');
        } else {
            $(this.el).removeClass('remote');
        }
    }   
});
var ScaleManager = Backbone.View.extend({
	el: null,
	model: null,
   	initialize: function(){
		_.bindAll(this, 'render', 'scaleContainer', 'validateDOM', 'scaleTarget', 'setTargetOrigin');
        this.render();
  	},
    render: function() {
        if (this.validateDOM()==true) {
			this.model.bind('change:scaleAssets', this.scaleContainer, this);
        } 
    },
    scaleContainer: function(amount) {
        if ((Number(($(window)).width()))<this.model.get ('cameraMaxWidth')) { 
            this.scaleTarget (this.el, ((((Number(($(window)).width()))*100)/this.model.get('cameraMaxWidth'))/100))
            this.setTargetOrigin (this.el, 'left top 0');
        } else if ((Number(($(window)).height()))<this.model.get ('appHeight')) { 
            this.scaleTarget (this.el, ((((Number(($(window)).height()))*100)/this.model.get('appHeight'))/100))
            this.setTargetOrigin (this.el, 'center top 0');
        } else {
            this.scaleTarget (this.el, 1)
            this.setTargetOrigin (this.el, 'center top 0');
        }
    },
    validateDOM: function() {
        if ($(this.el).length > 0) {
            return (true);
        } else {
            return (false);
        }
    },
    scaleTarget: function(target, amount) {
        $(target).css('transform','scale('+amount+','+amount+')');
        $(target).css('ms-transform','scale('+amount+','+amount+')');
        $(target).css('-webkit-transform','scale('+amount+','+amount+')');
    },
    setTargetOrigin: function(target, amount) {
        $(target).css('transform-origin', amount);
        $(target).css('-ms-transform-origin', amount);
        $(target).css('-webkit-transform-origin', amount);   
    }
});
var ControllerItem = Backbone.View.extend({   
	el: null,
	events: function() {
		return _.extend({'click #btn-record': 'toggleRecord'},{'click #btn-cancel': 'clearRecording'},{'click #btn-rewind': 'reloadRecording'},{'click .remote': 'toggleRemote'},{'dragover .file-drop': 'fileDragOver'},{'drop .file-drop': 'fileDragDrop'});
	},	
    initialize: function(){
    	_.bindAll(this, 'render', 'resizeWindow', 'toggleRecord', 'clearRecording', 'reloadRecording', 'toggleRemote', 'processFile', 'fileDragOver', 'fileDragDrop');
		this.render();
    },
	render: function(){
		var cameraViewReference = this.model.get('cameraViewReference');
		cameraViewReference.render();
		$(window).bind("resize", this.resizeWindow)
    },
	resizeWindow: function(){
		this.model.set ('scaleAssets', !this.model.get ('scaleAssets'));
	},
	toggleRecord: function(event) {
		this.model.set ('publishRecording', !this.model.get('publishRecording'));
	},
	clearRecording: function(event) {
		this.model.set ('prepRecording', !this.model.get('prepRecording'));
	},
	reloadRecording: function(event) {
		this.model.set('fileLoad', !this.model.get('fileLoad'));	
	},
    toggleRemote: function(event) {
        this.model.set ('prepRecording', !this.model.get('prepRecording'));
        this.model.set('toggleRemote', !this.model.get('toggleRemote'));
    },
    processFile: function(file) {
		this.model.set('fileShareAddress', file);
        this.model.set('fileShareMimeType', file.type);
        this.model.set('fileShareExtension', '.' + String(((file.name).split('.'))[((file.name).split('.')).length-1]));
		this.model.set('fileShareLoad', !this.model.get('fileShareLoad'));	
	},
	fileDragOver: function (event) {
		console.log ('fileDragOver');
		event.stopPropagation();
    	event.preventDefault();
		if (event.dataTransfer!=undefined) {
			//console.log (event.dataTransfer.files);
			event.dataTransfer.dropEffect = 'copy';
		} else if (event.originalEvent.dataTransfer!=undefined) {
			//console.log (event.originalEvent.dataTransfer.files);
			event.originalEvent.dataTransfer.dropEffect = 'copy';
		}
	},
	fileDragDrop: function (event) {
		console.log ('fileDragDrop');
		event.stopPropagation();
    	event.preventDefault();
        if (event.dataTransfer!=undefined) {
            console.log (event.dataTransfer.files);
			var files = event.dataTransfer.files;
        } else if (event.originalEvent.dataTransfer!=undefined) {
            console.log (event.originalEvent.dataTransfer.files);
			var files = event.originalEvent.dataTransfer.files;
        }
		if (files.length > 0) {
            var file = files[0];
			this.processFile(file);
        }
	}
});
$(document).ready(function() {
	(function($){
		var modelItem = new ModelItem();
        var socketView = new SocketView({
	  		model: modelItem
  		});
        var peerConnectionView = new PeerConnectionView({
	  		model: modelItem
  		});
		var playbackView = new PlaybackView({
	  		model: modelItem,
	  		el: $('#playback')
  		});
        var remoteView = new RemoteView({
	  		model: modelItem,
	  		el: $('#remote')
  		});
        var addressBarView = new AddressBarView({
	  		model: modelItem,
	  		el: $('.address-bar')
  		});
		var mediaRecorderView = new MediaRecorderView({
			model: modelItem
		});
		var menuView = new MenuView({
	  		model: modelItem,
	  		el: $('.menu')
  		});
        var fileDropView = new FileDropView({
	  		model: modelItem,
	  		el: $('.file-drop')
  		});
        var fileShareLoaderView = new FileShareLoaderView({
	  		model: modelItem,
  		});
        var thumbnailView = new ThumbnailView({
	  		model: modelItem,
	  		el: $('.thumbnails')
  		});
        var scaleManager = new ScaleManager({
			model: modelItem,
			el: $('.container')
		});
		var cameraView = new CameraView({
			model: modelItem,
			el: $('#camera')
		});
		modelItem.set ('cameraViewReference', cameraView);
		var controllerItem = new ControllerItem({
	  		model: modelItem,
	  		el: $('body')
  		});
	})(jQuery);
});