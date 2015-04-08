function delete_dom(htmlObject){
    while(htmlObject.firstChild){
        htmlObject.removeChild(htmlObject.firstChild);
    }
}
