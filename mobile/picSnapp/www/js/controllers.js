angular.module('starter.controllers', [])

    .controller('DashCtrl', function($scope) {})

    .controller('ChatsCtrl', function($scope, Chats) {
    // With the new view caching in Ionic, Controllers are only called
    // when they are recreated or on app start, instead of every page change.
    // To listen for when this page is active (for example, to refresh data),
    // listen for the $ionicView.enter event:
    //
    //$scope.$on('$ionicView.enter', function(e) {
    //});

    $scope.chats = Chats.all();
    $scope.remove = function(chat) {
        Chats.remove(chat);
    };
})

    .controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
    $scope.chat = Chats.get($stateParams.chatId);
})

    .controller('AccountCtrl', function($scope) {
    $scope.settings = {
        enableFriends: true
    };
})

//!The file upload controller
    .controller('UploadCtrl', function($scope, $cordovaFileTransfer, $cordovaImagePicker){

    $scope.upload = function(){

        var selectedImages = localStorage.getItem("selectedImages")
        
        var options = {
            fileKey: "avatar",
            fileName: "image.png",
            chunkedMode: false,
            mimeType: "image/png"
        };
        $cordovaFileTransfer.upload("http://127.0.0.1:1357/gtel/api/photo", selectedImages , options).then(function(result) {
            console.log("SUCCESS: " + JSON.stringify(result.response));
        }, function(err) {
            console.log("ERROR: " + JSON.stringify(err));
        }, function (progress) {
            // constant progress updates
        });  
    };

    $scope.pick = function(){

        var imgOptions = {
            maximumImagesCount: 20
            /*,width: 1000,
            height: 1000,
            quality: 100*/        
        };
        
        $cordovaImagePicker.getPictures(imgOptions)
        .then(function(results){

            localStorage.setItem("selectedImages", results);

            for(var i=0; i < results.length; i++ ){

                //!Do something here                

            };
        
        },function(err){
        
            //!Display photo capture error
        
        });


    };

});