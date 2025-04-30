import React, { useState, useEffect } from 'react';
import { secureStorage } from '../utils/secureStorage';
import '../styles/profile-page.css';

// 1) Friends Number
// 2) Add/Remove Self Error Handleing

const DisplayUserInfoList = ({ userInfo }) => {
  return (
    <div className="profile-friends-list">
        <ul id="profile-userinfo-list">
          <li>GCASP Username: {userInfo.userName}</li>
          <li>GCASP Email: {userInfo.userEmail}</li>
          <li>GCASP Friends: {userInfo.userFriendCount}</li>
        </ul>
    </div>
  );
};

const DisplayFriendsList = ({ friendsList }) => {
  return (
    <div className="profile-friends-list">
      {friendsList.length > 0 ? (
        <ul id="profile-friends-list">
          {friendsList.map((friend, index) => (
            <li key={index}>{friend}</li>
          ))}
        </ul>
      ) : (
        <p>No Friends Added, Add Some Friends</p>
      )}
    </div>
  );
};

const FriendUsernameInput = ({ friendUsername, setFriendUsername }) => {
  const handleChangeFriendUsername = (event) => {
    setFriendUsername(event.target.value);
  };

  return (
    <div>
      <label htmlFor="textInput">Enter Friend Username:</label>
      <input
        type="text"
        id="textInput"
        value={friendUsername}
        onChange={handleChangeFriendUsername}
        placeholder="Enter Your Friend's GCASP Username"
      />
    </div>
  );
};

const ProfilePage = () => {
  const [friendsList, setFriendsList] = useState([]);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showRemoveFriends, setShowRemoveFriends] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  
  // Error Message Handeling
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // User Info Object
  const [userInfo, setUserInfo] = useState ({
    userName: "",
    userEmail: "",
    userFriendCount: 0
  });

  const updateFriendsList = async () => {
    // Friends List
    const token = await secureStorage.getToken();
    const responseData = await window.electron.getFriendsList(token);
    const usernamesList = responseData.friends.map(friend => friend.username);
    setUserInfo(prev => ({...prev, userFriendCount: usernamesList.length}));
    setFriendsList(usernamesList);
  }

  // Assigning User Infomation
  useEffect(() => {
    const assignUserInfo = async () => {
        // Name & Email
        const user = await secureStorage.getUser(); 
        setUserInfo(prev => ({
          ...prev,
          userName: user.username,
          userEmail: user.email
        }));

        // Friends List
        updateFriendsList();
      };

    assignUserInfo(); // Call the function
  }, []); // Only run on component mount
  
  // Adding Friends

  const triggerAddFriends = () => {
    setShowAddFriends(true);
  };

  const cancelAddFriends = () => {
    setShowAddFriends(false);
    setFriendUsername("");
  };

  const submitAddFriends = async () => {
    if(friendUsername === userInfo.userName) { 
      setErrorMessage("Error: Cannot Add Oneself")
      setShowError(true);
      return; 
    } else if(friendUsername === "") { 
      setErrorMessage("Error: Username Cannot Be Empty")
      setShowError(true);
      return; 
    }
    
    // Trigger Adding Friend On Backend:
    const token = await secureStorage.getToken();
    const response = await window.electron.addFriend(friendUsername, token);
    
    if(!response.success) {
      setErrorMessage("Friend Username Not Found");
      setShowError(true);
    } else { 
      updateFriendsList();
      setShowAddFriends(false); 
    }

    setFriendUsername("");
  };

  // Removing Friends

  const submitRemoveFriends = async () => {
    // Error Handeling
    if (friendUsername === userInfo.userName) { 
      setErrorMessage("Error: Cannot Remove Oneself")
      setShowError(true);
      return; 
    }
    else if (friendUsername === "") { 
      setErrorMessage("Error: Username Cannot Be Empty")
      setShowError(true);
      return; 
    }

    // Trigger Adding Friend On Backend:
    const token = await secureStorage.getToken();
    const response = await window.electron.removeFriend(friendUsername, token);

    if(!response.success) {
      setErrorMessage("Friend Username Not Found");
      setShowError(true);
    } else { 
      updateFriendsList();
      setShowRemoveFriends(false); 
    }

    setFriendUsername("");
  };

  const triggerRemoveFriends = () => {
    setShowRemoveFriends(true);
  };

  const cancelRemoveFriends = () => {
    setShowRemoveFriends(false);
    setFriendUsername("");
  };
  
  // Error Message Handeling
  const cancelError = () => {
    setErrorMessage("");
    setShowError(false);
  };

  // JSX Component

  return (
    <div className="profile-page">
      {/* Add Friend Modal Window */}
      {showAddFriends && (
        <div className="add-friends-modal">
          <div className="modal-content">
            <FriendUsernameInput
              friendUsername={friendUsername}
              setFriendUsername={setFriendUsername}
            />
            <div className="modal-buttons-container">
              <button className="cancel-button" onClick={cancelAddFriends}>
                Cancel
              </button>
              <button className="add-friend-button" onClick={submitAddFriends}>
                Add Friend
              </button>
              {showError && (
                <div className="overlay">
                  <div>
                    <div className="addErrorMessage"> {errorMessage} </div>
                    <button className="cancelErrorButton" onClick={cancelError}>
                      Ok
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Friends */}
      {showRemoveFriends && (
        <div className="remove-friends-modal">
          <div className="modal-content">
            <FriendUsernameInput
              friendUsername={friendUsername}
              setFriendUsername={setFriendUsername}
            />
            <div className="modal-buttons-container">
              <button className="cancel-button" onClick={cancelRemoveFriends}>
                Cancel
              </button>
              <button className="remove-friend-button" onClick={submitRemoveFriends}>
                Remove Friend
              </button>
              {showError && (
                <div className="overlay">
                  <div>
                    <div className="addErrorMessage"> {errorMessage} </div>
                    <button className="cancelErrorButton" onClick={cancelError}>
                      Ok
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="profile-page-header">GCASP Profile</div>

      <div className="profile-info">
        <label htmlFor="profile-info">User Info</label>
        <div id="userInfo">
          <DisplayUserInfoList userInfo={userInfo} />
        </div>
      </div>

      <div className="profile-friends-list">
        <label htmlFor="profile-friends-list">User Friends List</label>
        <div id="friends_list">
          <DisplayFriendsList friendsList={friendsList} />
        </div>
      </div>

      <div className="friend-actions">
        <button className="add-friend-button" onClick={triggerAddFriends}>
          Add Friend
        </button>
        <button className="remove-friend-button" onClick={triggerRemoveFriends}>
          Remove Friend
        </button>
      </div>

    </div>
  );
};

export default ProfilePage;
