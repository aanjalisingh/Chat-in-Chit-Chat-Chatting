import React, { useEffect, useState , useRef } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { useContext } from 'react';
import { UserContext } from './UserContext';
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact";


// import { text } from "express";


export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [isConnected, setIsConnected] = useState(false); 
    const [selectedUserId,setSelectedUserId]=useState(null);
    const [newMessageText,setNewMessageText]=useState('');
    const [messages,setMessages]=useState([]);
    const {username,id,setUsername,setId}=useContext(UserContext);
    const divUnderMessages = useRef();


  
    useEffect(() => {
        // Create a new WebSocket connection
        const wsConnection = new WebSocket('ws://localhost:4040');
        setWs(wsConnection); 

        // Handle WebSocket connection open
        wsConnection.addEventListener('open', () => {
            console.log('Connected to WebSocket server');
            setIsConnected(true); // Set connection state
        });

        // Handle WebSocket messages
        wsConnection.addEventListener('message', handleMessage);

        // Handle WebSocket close
        wsConnection.addEventListener('close', () => {
            setTimeout(()=>{
            console.log('Disconnected from WebSocket server, Trying to connect');
            setIsConnected(false);    
            },1000);
        });

        return () => { 
            wsConnection.close();
        };
    }, []);

    function showOnlinePeople(peopleArray) {
        console.log('Received people array:', peopleArray); 
        const people = {};
        peopleArray.forEach(person => {
            console.log('Processing person:', person);
            const { userId, username } = person;
            console.log('Extracted userId:', userId, 'Extracted username:', username);
            people[userId] = username;
        });
        console.log('Processed online people:', people);
        setOnlinePeople(people);
    }
    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        console.log({ev,messageData});
        console.log('Received message:', messageData); 
        if ('online' in messageData) {
            console.log('Online people:', messageData.online); 
            showOnlinePeople(messageData.online);
        }
        else if('text' in messageData){
            setMessages(prev=>([...prev,{...messageData}]));      
        } 
    }

    //  function logout(){
    //      axios.post('/logout').then(()=>{
    //         setWs(null);
    //         setId(null);
    //         setUsername(null);
    //  });
    // }
    function logout() {
        axios.post('/logout')
            .then(() => {
                setWs(null);
                setId(null);
                setUsername(null);
            })
            .catch(error => {
                console.error('Logout failed:', error);
            });
    }
    function sendMessage(ev,file = null) {
        if(ev) ev.preventDefault();
        ws.send(JSON.stringify({
                recipient: selectedUserId,
                text: newMessageText,
                file,
        }));
        
        if(file){
            axios.get('/messages/'+selectedUserId).then(res=>{
                setMessages(res.data);
            });
        }
        else{
            setNewMessageText('');
        console.log('message sent');
        setMessages(prev=>([...prev,{
            text:newMessageText,
            sender: id,
            recipient: selectedUserId,
            _id:Date.now(),
        }]));
        }
    }

    function sendFile(ev){
          const reader = new FileReader();
          reader.readAsDataURL(ev.target.files[0]);
          reader.onload =() => {
           sendMessage(null,{
            name:ev.target.files[0].name,
            data:reader.result,
           });
          };
          
    }
      useEffect(() => {
        const div= divUnderMessages.current;
        if(div){
        div.scrollIntoView({behavior:'smooth' , block:'end'});    
        }
      },[messages]);


     useEffect(()=>{
           axios.get('/people').then(res=>{
           const offlinePeopleArr = res.data.
           filter(p => p._id !== id)
           .filter(p => ! Object,keys(onlinePeople).includes(p._id));
           const offlinePeople = {};
           offlinePeopleArr.forEach(p=>{
             offlinePeople[p._id]=p;
           });
            // console.log({offlinePeople,offlinePeopleArr});
           setOfflinePeople(offlinePeople);
     });

     },[onlinePeople]);



      useEffect(()=>{
         if(selectedUserId){
              axios.get('/messages/'+selectedUserId).then(res=>{
                  setMessages(res.data);
              });
         }
      },[selectedUserId]);

    const onlinePeopleExclOurUser = {...onlinePeople };
    delete onlinePeopleExclOurUser[id];

    
    const messageWithoutDupes = uniqBy(messages,'_id');




    return (
        <div className="flex h-screen">
     
            <div className="bg-white w-1/3 flex-col">
            <div className="flex-grow">
            <Logo />
                {Object.keys(onlinePeopleExclOurUser).map(userId => (
                  <Contact 
                  key={userId}
                  id={userId} 
                  online={true}         
                  username={onlinePeopleExclOurUser[userId]}
                  onClick={()=> setSelectedUserId(userId)}
                   selected={userId === selectedUserId} 
                    />         
               ))}
                  {Object.keys(offlinePeople).map(userId => (
                  <Contact 
                  key={userId}
                  id={userId} 
                  online={false}         
                  username={offlinePeople[userId].username}
                  onClick={()=> setSelectedUserId(userId)}
                   selected={userId === selectedUserId}  
                   />         
               ))}
            </div>     
          <div className="p-2 text-center flex items-center justify-center">
            <span className="mr-2 text-sm text-gray-600 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
            </svg>
                {username}
                </span>
            <button 
            onClick={logout}
            className="text-sm bg-blue-200 py-1 px-2 text-gray-500 border rounded-sm">LogOut</button>
          </div>
            </div>
            <div className="flex flex-col bg-blue-200 w-2/3 p-2">
                <div className="flex-grow">
                   {!selectedUserId && (
                   <div className="flex h-full flex-grow items-center justify-center ">
                   <div className="text-gray-800">&larr; Select a person from the sidebar</div>
                   </div>
                     )} 
                     {!!selectedUserId && (
                        <div className="mb-4 h-full">
                         <div className="relative h-full ">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                            {messageWithoutDupes.map(message => (
                                <div key={message._id} className={(message.sender===id ? 'text-right' : 'text-left')}>
                                <div className={"text-left inline-block p-2 my-2 rounded-md text-sm "+(message.sender=== id ? 'bg-blue-500 text-white': 'bg-white text-gray-500')}>
                                   {message.text}
                                   {message.file && (
                                    <div className="">
                                        
                                        <a target="_" className="flex items-center gap-1 border-b" href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                       <path fill-rule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clip-rule="evenodd" />
                          </svg>
                                        {message.file}
                                        </a>
                                    </div>
                                   )}
                                   </div>
                                   </div>
                            ))}

                           <div ref={divUnderMessages}></div> 
                        </div>
                        </div>
                        </div> 
                     )}
                </div>
                {!!selectedUserId && (
                     <form className="flex gap-2" onSubmit={sendMessage}>
                     <input
                         type="text"
                         value={newMessageText}
                         onChange={(ev) => setNewMessageText(ev.target.value)}
                         placeholder="Type your message here"
                         className="bg-white flex-grow border rounded-sm p-2"
                     />
                     <label className="bg-blue-200 p-2 text-gray-600 cusror-pointer rounded-sm border-blue-800">
                      <input type="file" className="hidden" onChange={sendFile}/>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                      <path fill-rule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clip-rule="evenodd" />

                    </svg>
                     </label>
                     <button type="submit" className="bg-blue-500 p-2 text-white rounded-sm">
                         <svg
                             xmlns="http://www.w3.org/2000/svg"
                             fill="none"
                             viewBox="0 0 24 24"
                             strokeWidth={1.5}
                             stroke="currentColor"
                             className="w-6 h-6"
                         >
                             <path
                                 strokeLinecap="round"
                                 strokeLinejoin="round"
                                 d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                             />
                         </svg>
                     </button>
                 </form>
                )}
               
            </div>
        </div>
    );
}
