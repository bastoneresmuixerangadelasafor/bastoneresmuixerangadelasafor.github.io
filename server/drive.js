function getAudioById_({ audioId }) {
  if(audioId){    
    try{
      const file = DriveApp.getFileById(audioId);
      const blob = file.getBlob();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      // const mimeType = blob.getContentType();
      const audioData = 'data:audio/mpeg;base64,' + base64Data;
      
      return API.newResult_({ result: {audioData: audioData} });
    } catch (error){
      console.error("Error loading audio file:", error);
      return API.newError_({ error: "Error al carregar el fitxer d'àudio." });
    }
  }
}